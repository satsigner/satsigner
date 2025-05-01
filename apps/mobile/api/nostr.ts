import type { NDKKind } from '@nostr-dev-kit/ndk'
import NDK, { NDKEvent, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk'
import { getPublicKey, nip19, nip44 } from 'nostr-tools'

export interface NostrKeys {
  nsec: string
  npub: string
  secretNostrKey: Uint8Array
}

export interface NostrMessage {
  content: string
  created_at: number
  pubkey: string
  decryptedContent?: string
  isSender?: boolean
}

export class NostrAPI {
  private ndk: NDK | null = null

  constructor(private relays: string[]) {
    // Add default reliable relays if none provided
    if (!relays || relays.length === 0) {
      this.relays = [
        'wss://relay.damus.io',
        'wss://nostr.bitcoiner.social',
        'wss://relay.nostr.band',
        'wss://nos.lol'
      ]
    }
  }

  async connect() {
    try {
      // Initialize NDK if not already initialized
      if (!this.ndk) {
        this.ndk = new NDK({
          explicitRelayUrls: this.relays
        })
      }

      // Ensure NDK is connected
      await this.ndk.connect()

      // Ensure pool is initialized and connected
      if (!this.ndk.pool) {
        throw new Error('NDK pool not initialized')
      }

      await this.ndk.pool.connect()

      // Verify relay connections
      const connectedRelays = Array.from(this.ndk.pool.relays.keys())
      console.log('Connected relays:', connectedRelays)

      if (connectedRelays.length === 0) {
        throw new Error(
          'No relays could be connected. Please check your relay URLs and internet connection.'
        )
      }

      // Test each relay's connection with retries
      const relayStatus = await Promise.all(
        connectedRelays.map(async (url) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const relay = this.ndk?.pool.relays.get(url)
              if (!relay) return { url, status: 'not_found' }

              // Try to fetch a simple event to test the connection
              const testEvent = await this.ndk?.fetchEvent(
                { kinds: [1], limit: 1 },
                // @ts-ignore - relayUrl is used by NDK but not in types
                { relayUrl: url }
              )

              // If we get here, the relay is working
              return { url, status: 'connected', testEvent: testEvent !== null }
            } catch (_error) {
              if (attempt === 2) {
                return { url, status: 'error' }
              }
              // Wait before retry
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (attempt + 1))
              )
            }
          }
          return { url, status: 'error' }
        })
      )

      console.log('Relay status:', relayStatus)

      // If no relays are working, throw an error
      const workingRelays = relayStatus.filter((r) => r.status === 'connected')
      if (workingRelays.length === 0) {
        throw new Error(
          'No relays are responding. Please check your internet connection and try again.'
        )
      }

      return true
    } catch (error) {
      console.error('Relay connection error:', error)
      this.ndk = null // Reset ndk on error
      throw new Error(
        'Failed to connect to relays: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    }
  }

  static async generateNostrKeys(): Promise<NostrKeys> {
    const signer = NDKPrivateKeySigner.generate()
    const user = await signer.user()
    const secretNostrKey = new Uint8Array(
      Buffer.from(signer.privateKey!, 'hex')
    )
    const nsec = nip19.nsecEncode(secretNostrKey)
    const npub = user.npub

    return {
      nsec,
      npub,
      secretNostrKey
    }
  }

  async sendMessage(
    nsec: string,
    recipientNpub: string,
    content: string
  ): Promise<void> {
    // Decode the nsec
    const { type, data: secretNostrKey } = nip19.decode(nsec)

    // Check if the decoded type is 'nsec'
    if (type !== 'nsec') {
      throw new Error('Input is not a valid nsec')
    }

    // Validate inputs
    if (!secretNostrKey || secretNostrKey.length !== 32) {
      throw new Error('Invalid secretNostrKey: must be a 32-byte Uint8Array')
    }
    if (!recipientNpub) {
      throw new Error('Invalid recipientNpub: must be a non-empty string')
    }

    // Validate npub or hex format
    const isNpub =
      recipientNpub.startsWith('npub') &&
      recipientNpub.length === 63 &&
      /^[a-z0-9]+$/.test(recipientNpub)
    const isHex = /^[0-9a-f]{64}$/.test(recipientNpub)
    if (!isNpub && !isHex) {
      throw new Error(
        'Invalid recipientNpub: must be a valid npub (63 characters, lowercase) or 64-character hex public key'
      )
    }

    // Connect to relays
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    // Convert secretNostrKey (Uint8Array) to hex string
    const secretNostrKeyHex = Buffer.from(secretNostrKey).toString('hex')
    const ourPubkey = getPublicKey(secretNostrKey)

    // Decode recipient's npub or use hex directly
    let recipientPubkey: string
    if (isNpub) {
      try {
        const { data } = nip19.decode(recipientNpub) as { data: string }
        recipientPubkey = data
        if (!/^[0-9a-f]{64}$/.test(recipientPubkey)) {
          throw new Error(
            'Decoded recipientPubkey is not a valid 64-character hex string'
          )
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        throw new Error(
          'Invalid recipientNpub (checksum error): ' + errorMessage
        )
      }
    } else {
      recipientPubkey = recipientNpub // Use hex directly
    }

    // Create NDKUser for recipient with proper pubkey format
    const recipientUser = new NDKUser({
      npub: nip19.npubEncode(recipientPubkey),
      relayUrls: this.relays
    })
    recipientUser.ndk = this.ndk

    // Ensure proper encoding before encryption
    const encodedContent = unescape(encodeURIComponent(content))

    // Create signer with proper key format
    const signer = new NDKPrivateKeySigner(secretNostrKeyHex)
    if (!signer) throw new Error('Failed to create NDKPrivateKeySigner')

    // Step 1: Create the kind:14 chat message event (unsigned as per NIP-17)
    const kind14Event = new NDKEvent(this.ndk, {
      kind: 14,
      pubkey: ourPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        [
          'p',
          recipientPubkey,
          this.relays[Math.floor(Math.random() * this.relays.length)]
        ]
      ],
      content: encodedContent
    })

    // Encrypt kind:14 event using NIP-44
    try {
      await kind14Event.encrypt(recipientUser, signer)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      try {
        const conversationKey = nip44.getConversationKey(
          secretNostrKey,
          recipientPubkey
        )
        const encryptedContent = nip44.encrypt(encodedContent, conversationKey)
        kind14Event.content = encryptedContent
      } catch (fallbackError) {
        const fallbackErrorMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Unknown error'
        throw new Error(
          `Failed to encrypt kind:14 event (both NDK and fallback): ${errorMessage}, ${fallbackErrorMessage}`
        )
      }
    }

    // Step 2: Create sealed kind:13 event
    const kind13Event = new NDKEvent(this.ndk, {
      kind: 13,
      pubkey: ourPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        [
          'p',
          recipientPubkey,
          this.relays[Math.floor(Math.random() * this.relays.length)]
        ]
      ],
      content: kind14Event.content
    })

    // Sign kind:13 event (this is required as per NIP-59)
    try {
      await kind13Event.sign(signer)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error('Failed to sign kind:13 event: ' + errorMessage)
    }

    // Step 3: Create kind:1059 gift-wrap event with random pubkey and timestamp
    const randomRelay =
      this.relays[Math.floor(Math.random() * this.relays.length)]
    const randomTimestamp = Math.floor(
      Date.now() / 1000 - Math.random() * 172800
    ) // Random time up to 2 days ago
    const randomPubkey = getPublicKey(
      new Uint8Array(32).fill(Math.floor(Math.random() * 256))
    )

    const kind1059Event = new NDKEvent(this.ndk, {
      kind: 1059 as NDKKind,
      pubkey: randomPubkey, // Random pubkey for privacy
      created_at: randomTimestamp,
      tags: [['p', recipientPubkey, randomRelay]],
      content: JSON.stringify(await kind13Event.toNostrEvent())
    })

    // Sign the gift wrap event
    try {
      await kind1059Event.sign(signer)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error('Failed to sign kind:1059 event: ' + errorMessage)
    }

    // Step 4: Publish event
    try {
      // Verify we have connected relays before publishing
      if (!this.ndk || Array.from(this.ndk.pool.relays.keys()).length === 0) {
        throw new Error('No connected relays available for publishing')
      }

      // Log the raw event in pretty format
      console.log(
        'Raw event:',
        JSON.stringify(await kind1059Event.toNostrEvent(), null, 2)
      )

      // Publish with timeout and retry
      const publishWithRetry = async (event: NDKEvent, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            console.log(`Attempt ${i + 1} to publish event...`)
            await event.publish()

            // Wait a bit longer for the event to propagate
            await new Promise((resolve) => setTimeout(resolve, 3000))

            // Verify event was published by checking relays
            const isPublished = await verifyPublished(event)
            if (isPublished) {
              console.log('Event published successfully')
              return true
            }

            console.log('Event not found on relays, retrying...')
            if (i === retries - 1) {
              throw new Error('Event not published successfully')
            }

            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
          } catch (err) {
            console.error(`Publish attempt ${i + 1} failed:`, err)
            if (i === retries - 1) throw err
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
          }
        }
        return false
      }

      // Verify event was published by checking relays
      const verifyPublished = async (event: NDKEvent): Promise<boolean> => {
        try {
          if (!this.ndk) return false

          // Check each relay individually
          const relayStatus = await Promise.all(
            Array.from(this.ndk.pool.relays.entries()).map(async ([url]) => {
              try {
                console.log(`Checking relay ${url} for event...`)
                const publishedEvent = await this.ndk?.fetchEvent({
                  kinds: [event.kind as NDKKind],
                  authors: [event.pubkey],
                  ids: [event.id]
                })

                return { url, success: publishedEvent !== null }
              } catch (_err) {
                return { url, success: false }
              }
            })
          )

          console.log('Relay verification status:', relayStatus)
          // Check if any relay has the event
          return relayStatus.some((status) => status.success)
        } catch (_err) {
          return false
        }
      }

      await publishWithRetry(kind1059Event)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(
        `Failed to publish event: ${errorMessage}. Please check your relay connections and try again.`
      )
    }
  }

  async fetchMessages(
    nsec: string,
    recipientNpub: string,
    since?: number,
    limit: number = 30
  ): Promise<NostrMessage[]> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    // Decode the nsec
    const { type, data: secretNostrKey } = nip19.decode(nsec)

    // Check if the decoded type is 'nsec'
    if (type !== 'nsec') {
      throw new Error('Input is not a valid nsec')
    }

    const user = this.ndk.getUser({ npub: recipientNpub })
    const ourPubkey = getPublicKey(secretNostrKey)

    try {
      // Create a subscription to fetch events
      const subscriptionQuery = {
        kinds: [1059 as NDKKind],
        '#p': [ourPubkey], // Events where we are the recipient
        authors: [user.pubkey], // Events from the other user
        limit
      }
      console.log('Subscription query:', subscriptionQuery)
      const subscription = this.ndk?.subscribe(subscriptionQuery)

      // Also subscribe to our own sent messages
      const sentMessagesQuery = {
        kinds: [1059 as NDKKind],
        authors: [ourPubkey], // Our sent messages
        '#p': [user.pubkey], // Where the other user is the recipient
        limit
      }
      console.log('Sent messages query:', sentMessagesQuery)
      const sentSubscription = this.ndk?.subscribe(sentMessagesQuery)

      // Subscribe to self-messages (where we are both sender and recipient)
      const selfMessagesQuery = {
        kinds: [1059 as NDKKind],
        authors: [ourPubkey], // We are the sender
        '#p': [ourPubkey], // We are also the recipient
        limit
      }
      console.log('Self messages query:', selfMessagesQuery)
      const selfSubscription = this.ndk?.subscribe(selfMessagesQuery)

      // Collect events from all subscriptions
      const events = new Set<NDKEvent>()
      subscription?.on('event', (event) => {
        events.add(event)
      })
      sentSubscription?.on('event', (event) => {
        events.add(event)
      })
      selfSubscription?.on('event', (event) => {
        events.add(event)
      })

      // Wait for all subscriptions to complete
      await Promise.all([
        new Promise((resolve) => {
          subscription?.on('eose', () => resolve(true))
          setTimeout(resolve, 5000)
        }),
        new Promise((resolve) => {
          sentSubscription?.on('eose', () => resolve(true))
          setTimeout(resolve, 5000)
        }),
        new Promise((resolve) => {
          selfSubscription?.on('eose', () => resolve(true))
          setTimeout(resolve, 5000)
        })
      ])

      // Process gift wrap messages
      const decryptedMessages = await Promise.all(
        Array.from(events).map(async (giftWrapEvent: NDKEvent) => {
          try {
            // Parse the gift wrap content which contains the kind:13 event
            const kind13Event = JSON.parse(giftWrapEvent.content)

            // Determine if we're the sender or recipient
            const isSender = giftWrapEvent.pubkey === ourPubkey
            const otherPubkey = isSender ? user.pubkey : ourPubkey

            // Decrypt the kind:13 event content using NIP-44
            const conversationKey = nip44.getConversationKey(
              secretNostrKey,
              otherPubkey
            )

            const decryptedContent = nip44.decrypt(
              kind13Event.content,
              conversationKey
            )

            // Ensure proper encoding of decrypted content
            const decodedContent = decodeURIComponent(escape(decryptedContent))

            return {
              content: kind13Event.content,
              created_at:
                kind13Event.created_at ?? Math.floor(Date.now() / 1000),
              pubkey: kind13Event.pubkey,
              decryptedContent: decodedContent,
              isSender
            }
          } catch (_error) {
            return {
              content: giftWrapEvent.content,
              created_at:
                giftWrapEvent.created_at ?? Math.floor(Date.now() / 1000),
              pubkey: giftWrapEvent.pubkey,
              decryptedContent: '[Failed to decrypt]',
              isSender: giftWrapEvent.pubkey === ourPubkey
            }
          }
        })
      )

      // Sort messages by timestamp, newest first
      return decryptedMessages.sort(
        (a: NostrMessage, b: NostrMessage) =>
          (b.created_at ?? 0) - (a.created_at ?? 0)
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      throw new Error(
        `Failed to fetch messages: ${errorMessage}. Please check your relay connections and try again.`
      )
    }
  }

  async disconnect() {
    this.ndk = null
  }
}
