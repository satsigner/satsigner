import type { NDKKind, NDKSubscription } from '@nostr-dev-kit/ndk'
import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import { Buffer } from 'buffer'
import { type Event, nip17, nip19, nip59 } from 'nostr-tools'
import { toast } from 'sonner-native'

import type { NostrKeys, NostrMessage } from '@/types/models/Nostr'
import { randomKey } from '@/utils/crypto'

export class NostrAPI {
  private ndk: NDK | null = null
  private activeSubscriptions: Set<NDKSubscription> = new Set()
  private processedMessageIds: Set<string> = new Set()
  private eventQueue: NostrMessage[] = []
  private isProcessingQueue = false
  private readonly BATCH_SIZE = 10
  private readonly PROCESSING_INTERVAL = 200 // ms
  private onLoadingChange?: (isLoading: boolean) => void

  constructor(private relays: string[]) {
    if (!relays || relays.length === 0) {
      this.relays = [
        'wss://relay.damus.io',
        'wss://nostr.bitcoiner.social',
        'wss://relay.nostr.band',
        'wss://nostr.mom'
      ]
    }
  }

  getRelays(): string[] {
    return this.relays
  }

  setLoadingCallback(callback: (isLoading: boolean) => void) {
    this.onLoadingChange = callback
  }

  private setLoading(loading: boolean) {
    this.onLoadingChange?.(loading)
  }

  async connect() {
    if (!this.ndk) {
      this.ndk = new NDK({
        explicitRelayUrls: this.relays
      })
    }

    await this.ndk.connect()

    if (!this.ndk.pool) {
      throw new Error('NDK pool not initialized')
    }

    await this.ndk.pool.connect()

    const connectedRelays = Array.from(this.ndk.pool.relays.keys())

    if (connectedRelays.length === 0) {
      throw new Error(
        'No relays could be connected. Please check your relay URLs and internet connection.'
      )
    }

    const relayStatus = await Promise.all(
      connectedRelays.map(async (url) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const relay = this.ndk?.pool.relays.get(url)
            if (!relay) {
              return { url, status: 'not_found' }
            }

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
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (attempt + 1))
            )
          }
        }
        return { url, status: 'error' }
      })
    )

    const workingRelays = relayStatus.filter((r) => r.status === 'connected')
    if (workingRelays.length === 0) {
      throw new Error(
        'No relays are responding. Please check your internet connection and try again.'
      )
    }

    return true
  }

  static async generateNostrKeys(): Promise<NostrKeys> {
    // Generate random bytes using react-native-aes-crypto
    const randomHex = await randomKey(32)
    const randomBytesArray = new Uint8Array(Buffer.from(randomHex, 'hex'))

    // Use the private key directly with NDKPrivateKeySigner
    const signer = new NDKPrivateKeySigner(randomBytesArray)
    const user = await signer.user()
    const nsec = nip19.nsecEncode(randomBytesArray)
    const npub = user.npub

    return {
      nsec,
      npub,
      secretNostrKey: randomBytesArray
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.eventQueue.length === 0) return

    this.isProcessingQueue = true
    const batch = this.eventQueue.splice(0, this.BATCH_SIZE)

    for (const message of batch) {
      if (!this.processedMessageIds.has(message.id)) {
        this.processedMessageIds.add(message.id)
        try {
          this._callback?.(message)
        } catch {
          toast.error('Failed to process message')
        }
      }
    }

    this.isProcessingQueue = false
    if (this.eventQueue.length > 0) {
      setTimeout(() => this.processQueue(), this.PROCESSING_INTERVAL)
    }
  }

  private _callback?: (message: NostrMessage) => void

  async subscribeToKind1059(
    recipientNsec: string,
    recipientNpub: string,
    _callback: (message: NostrMessage) => void,
    limit?: number,
    since?: number,
    onEOSE?: (nsec: string) => void
  ): Promise<void> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    this.setLoading(true)
    this._callback = _callback

    const { data: recipientSecretNostrKey } = nip19.decode(recipientNsec)
    const { data: recipientPubKey } = nip19.decode(recipientNpub)

    const TWO_DAYS = 48 * 60 * 60
    const bufferedSince = since ? since - TWO_DAYS : undefined

    const subscriptionQuery = {
      kinds: [1059 as NDKKind],
      //'#p': [recipientPubKeyFromNsec, recipientPubKey.toString()],
      '#p': [recipientPubKey.toString()],
      ...(limit && { limit }),
      since: bufferedSince
    }

    const subscription = this.ndk?.subscribe(subscriptionQuery)
    if (subscription) {
      this.activeSubscriptions.add(subscription)
    }

    subscription?.on('event', async (event) => {
      const rawEvent = await event.toNostrEvent()
      const unwrappedEvent = nip59.unwrapEvent(
        rawEvent as unknown as Event,
        recipientSecretNostrKey as Uint8Array
      )

      // Only queue if not already processed
      if (!this.processedMessageIds.has(unwrappedEvent.id)) {
        const message = {
          id: unwrappedEvent.id,
          content: unwrappedEvent,
          created_at: unwrappedEvent.created_at,
          pubkey: event.pubkey
        }

        this.eventQueue.push(message)
        this.processQueue()
      }
    })

    subscription?.on('eose', () => {
      onEOSE?.(recipientNsec)
      this.setLoading(false)
    })

    subscription?.on('close', () => {
      this.activeSubscriptions.delete(subscription)
    })
  }

  async closeAllSubscriptions() {
    for (const subscription of this.activeSubscriptions) {
      subscription.stop()
    }
    this.activeSubscriptions.clear()
    this.eventQueue = []
    this._callback = undefined
  }

  async createKind1059(
    nsec: string,
    recipientNpub: string,
    content: string
  ): Promise<NDKEvent> {
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

  async publishEvent(event: NDKEvent): Promise<void> {
    if (!this.ndk) {
      await this.connect()
    }

    if (!this.ndk) {
      throw new Error('Failed to initialize NDK')
    }

    const connectedRelays = Array.from(this.ndk.pool.relays.keys())

    if (event.ndk !== this.ndk) {
      event.ndk = this.ndk
    }
    if (!event.sig) {
      const signer = this.ndk.signer
      if (!signer) {
        throw new Error('No signer available for event')
      }
      await event.sign(signer)
    }

    let published = false
    const publishPromises = connectedRelays.map((url) => {
      return new Promise(async () => {
        const relay = this.ndk?.pool.relays.get(url)
        if (!relay) {
          return { url, success: false, error: 'Relay not found' }
        }

        try {
          await relay.publish(event)
          return { url, success: true }
        } catch (error) {
          return { url, success: false, error }
        }
      }) as Promise<{ url: string; success: boolean; error?: string }>
    })
    const results = await Promise.all(publishPromises)
    const successfulPublishes = results.filter((r) => r.success)
    if (successfulPublishes.length > 0) {
      published = true
    }

    if (!published) {
      throw new Error('Failed to publish after 3 attempts')
    }
  }
}
