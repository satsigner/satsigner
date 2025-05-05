import type { NDKKind } from '@nostr-dev-kit/ndk'
import NDK, { NDKEvent, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk'
import {
  getPublicKey,
  nip19,
  nip44,
  nip17,
  nip59,
  type Event
} from 'nostr-tools'
import { Buffer } from 'buffer'
import * as pako from 'pako'
import * as CBOR from 'cbor-js'
import { useAccountsStore } from '@/store/accounts'

export interface NostrKeys {
  nsec: string
  npub: string
  secretNostrKey: Uint8Array
}

export interface NostrMessage {
  content: any
  created_at: number
  decryptedContent?: string
  isSender?: boolean
  pubkey?: string
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
              if (!relay) {
                return { url, status: 'not_found' }
              }

              // Try to fetch a simple event to test the connection
              const testEvent = await this.ndk?.fetchEvent(
                { kinds: [1], limit: 1 },
                // @ts-ignore - relayUrl is used by NDK but not in types
                { relayUrl: url }
              )

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

      // If no relays are working, throw an error
      const workingRelays = relayStatus.filter((r) => r.status === 'connected')
      if (workingRelays.length === 0) {
        throw new Error(
          'No relays are responding. Please check your internet connection and try again.'
        )
      }

      return true
    } catch (error) {
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

  /*
















  */

  // TODO remove/replace with subscribeToKind1059

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

      const subscription = this.ndk?.subscribe(subscriptionQuery)

      // Also subscribe to our own sent messages
      const sentMessagesQuery = {
        kinds: [1059 as NDKKind],
        authors: [ourPubkey], // Our sent messages
        '#p': [user.pubkey], // Where the other user is the recipient
        limit
      }

      const sentSubscription = this.ndk?.subscribe(sentMessagesQuery)

      // Subscribe to self-messages (where we are both sender and recipient)
      const selfMessagesQuery = {
        kinds: [1059 as NDKKind],
        authors: [ourPubkey], // We are the sender
        '#p': [ourPubkey], // We are also the recipient
        limit
      }

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

            // Decode the base64 content
            const decodedContent = Buffer.from(
              decryptedContent,
              'base64'
            ).toString('utf-8')
            // Ensure proper encoding of decrypted content
            const finalContent = decodeURIComponent(escape(decodedContent))

            return {
              content: kind13Event.content,
              created_at:
                kind13Event.created_at ?? Math.floor(Date.now() / 1000),
              pubkey: kind13Event.pubkey,
              decryptedContent: finalContent,
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

  /*












*/

  async subscribeToKind1059(
    commonNsec: string,
    deviceNsec: string,
    _callback: (message: NostrMessage) => void,
    limit?: number,
    since?: number
  ): Promise<void> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    // Decode the nsec
    const { type: commonType, data: commonSecretNostrKey } =
      nip19.decode(commonNsec)
    const { type: deviceType, data: deviceSecretNostrKey } =
      nip19.decode(deviceNsec)

    // Check if the decoded type is 'nsec'
    if (commonType !== 'nsec' || deviceType !== 'nsec') {
      throw new Error('Input is not a valid nsec')
    }

    const commonPubkey = getPublicKey(commonSecretNostrKey as Uint8Array)
    const devicePubkey = getPublicKey(deviceSecretNostrKey as Uint8Array)

    // Create a subscription to fetch events
    const subscriptionQuery = {
      kinds: [1059 as NDKKind],
      '#p': [commonPubkey, devicePubkey],
      ...(limit && { limit }),
      ...(since && { since })
    }
    const subscription = this.ndk?.subscribe(subscriptionQuery)

    subscription?.on('event', async (event) => {
      const rawEvent = await event.toNostrEvent()
      if (!rawEvent.kind || !rawEvent.sig) {
        return
      }
      try {
        const unwrappedEvent = await nip59.unwrapEvent(
          rawEvent as unknown as Event,
          commonSecretNostrKey as Uint8Array
        )

        let eventContent = unwrappedEvent

        // Only process events that are newer than our since timestamp
        if (since && unwrappedEvent.created_at <= since) {
          return
        }

        _callback({
          content: eventContent,
          created_at: unwrappedEvent.created_at
        })
      } catch (_unwrapError) {
        // Handle unwrap error silently
      }
    })

    // Return a promise that resolves when the subscription is set up
    return new Promise((resolve) => {
      subscription?.on('eose', () => resolve())
      // Also resolve after a timeout to prevent hanging
      setTimeout(resolve, 5000)
    })
  }

  /*





















  */

  async createKind1059(
    nsec: string,
    recipientNpub: string,
    content: string
  ): Promise<NDKEvent> {
    // Decode the nsec
    const { data: secretNostrKey } = nip19.decode(nsec)
    const recipientPubkey = nip19.decode(recipientNpub) as { data: string }
    const encodedContent = unescape(encodeURIComponent(content))

    const wrap = nip17.wrapEvent(
      secretNostrKey as Uint8Array,
      { publicKey: recipientPubkey.data },
      encodedContent
    )
    const tempNdk = new NDK()
    const event = new NDKEvent(tempNdk, wrap)
    return event
  }

  /*










  





  */

  async publishEvent(event: NDKEvent): Promise<void> {
    try {
      // Ensure we're connected
      if (!this.ndk) {
        await this.connect()
      }

      if (!this.ndk) {
        throw new Error('Failed to initialize NDK')
      }

      // Get connected relays
      const connectedRelays = Array.from(this.ndk.pool.relays.keys())

      // Ensure event is using the correct NDK instance
      if (event.ndk !== this.ndk) {
        event.ndk = this.ndk
      }

      // Ensure event is signed
      if (!event.sig) {
        const signer = this.ndk.signer
        if (!signer) {
          throw new Error('No signer available for event')
        }
        await event.sign(signer)
      }

      let published = false
      for (let i = 0; i < 3; i++) {
        try {
          // Try to publish to each relay individually
          const publishPromises = connectedRelays.map(async (url) => {
            try {
              const relay = this.ndk?.pool.relays.get(url)
              if (!relay) {
                return { url, success: false, error: 'Relay not found' }
              }

              await relay.publish(event)
              return { url, success: true }
            } catch (error) {
              return { url, success: false, error }
            }
          })

          const results = await Promise.all(publishPromises)
          const successfulPublishes = results.filter((r) => r.success)
          if (successfulPublishes.length > 0) {
            published = true
            break
          }
        } catch (_err) {
          if (i < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }
      }

      if (!published) {
        throw new Error('Failed to publish after 3 attempts')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to publish event: ${errorMessage}`)
    }
  }
}

/*




























*/

// TODO: move to utilities

const BASE85 =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~'

function base85Encode(buf: Buffer) {
  // pad to 4-byte boundary
  const pad = (4 - (buf.length % 4)) % 4
  const data = pad
    ? Buffer.concat([buf, Buffer.alloc(pad)], buf.length + pad)
    : buf

  let out = ''
  for (let i = 0; i < data.length; i += 4) {
    // read 4 bytes as a big-endian uint32
    let acc = data.readUInt32BE(i)
    let chunk = ''
    // turn into 5 base-85 chars
    for (let j = 0; j < 5; j++) {
      chunk = BASE85[acc % 85] + chunk
      acc = Math.floor(acc / 85)
    }
    out += chunk
  }
  // drop padding characters
  return pad ? out.slice(0, out.length - pad) : out
}

const BASE85_DECODE = Object.fromEntries(
  BASE85.split('').map((ch, i) => [ch, i])
)

function base85Decode(str: string) {
  const len = str.length
  const rem = len % 5
  if (rem === 1) {
    throw new Error(`Invalid Base85 string length: mod 5 = ${rem}`)
  }
  // how many pad-chars we need to add to make a full 5-char block
  const padChars = rem ? 5 - rem : 0
  // this is also the number of bytes the encoder originally padded (and then dropped)
  const padBytes = padChars

  // pad the final, short group with the highest symbol ('~', value = 84)
  const padChar = BASE85[84]
  const full = padChars ? str + padChar.repeat(padChars) : str

  const out = []
  for (let i = 0; i < full.length; i += 5) {
    let acc = 0
    for (let j = 0; j < 5; j++) {
      const ch = full[i + j]
      const val = BASE85_DECODE[ch]
      if (val === undefined) {
        throw new Error(`Invalid character '${ch}' at position ${i + j}`)
      }
      acc = acc * 85 + val
    }
    // unpack into four bytes (big-endian)
    out.push((acc >>> 24) & 0xff)
    out.push((acc >>> 16) & 0xff)
    out.push((acc >>> 8) & 0xff)
    out.push(acc & 0xff)
  }

  // drop the same number of padding _bytes_ that were added during encoding
  return Buffer.from(out.slice(0, out.length - padBytes))
}

export function compressMessage(data: any) {
  try {
    const cborData = CBOR.encode(data)
    const jsonUint8 = new Uint8Array(cborData)

    const compressedData = pako.deflate(jsonUint8)
    const compressedBuffer = Buffer.from(compressedData)
    return base85Encode(compressedBuffer)
  } catch (_error) {
    throw new Error('Failed to compress data')
  }
}

export function decompressMessage(compressedString: string) {
  try {
    // 1) Base85 → Uint8Array
    const compressedBytes = base85Decode(compressedString)

    // 2) Inflate → Uint8Array of cbor bytes
    const cborBytes = pako.inflate(compressedBytes)

    // 3) Decode cbor → original object
    const bufferSlice = cborBytes.buffer.slice(
      cborBytes.byteOffset,
      cborBytes.byteOffset + cborBytes.byteLength
    )
    return CBOR.decode(bufferSlice as unknown as Uint8Array)
  } catch (err) {
    throw new Error(
      'Failed to decompress message: ' +
        (err instanceof Error ? err.message : 'Unknown error')
    )
  }
}
