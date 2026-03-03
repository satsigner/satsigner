import type { NDKKind, NDKSubscription } from '@nostr-dev-kit/ndk'
import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import { Buffer } from 'buffer'
import { type Event, nip17, nip19, nip59 } from 'nostr-tools'
import { toast } from 'sonner-native'

import type {
  NostrKeys,
  NostrKind0Profile,
  NostrMessage
} from '@/types/models/Nostr'
import { randomKey } from '@/utils/crypto'

const MAX_PROCESSED_RAW_IDS = 5000
const MAX_QUEUE_SIZE = 300
const PROCESSING_INTERVAL_MS = 350
const FLUSH_QUEUE_DELAY_MS = 50
/** Request enough kind 1059 events to discover all device announcements (members). Relays often default to ~100.
 *  Use a high limit because relay event order is not guaranteed (some return oldest-first); otherwise we can
 *  miss recent announcements when the relay returns oldest events first and we hit the limit. */
export const PROTOCOL_SUBSCRIPTION_LIMIT = 5000
/** When doing a full rescan (since=0), request more events to reduce chance of missing new announcements. */
export const PROTOCOL_SUBSCRIPTION_LIMIT_FULL_SCAN = 10000

export class NostrAPI {
  private ndk: NDK | null = null
  private activeSubscriptions: Set<NDKSubscription> = new Set()
  private processedMessageIds: Set<string> = new Set()
  private processedRawEventIds: Set<string> = new Set()
  private eventQueue: NostrMessage[] = []
  private isProcessingQueue = false
  private readonly BATCH_SIZE = 10
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

  /**
   * Fetches kind 0 (metadata) event for the given npub from relays.
   * Returns display name (name) and picture URL if available.
   * npub must decode to a 64-char hex pubkey (not a Bitcoin address or other format).
   */
  async fetchKind0(npub: string): Promise<NostrKind0Profile | null> {
    const decoded = nip19.decode(npub)
    if (!decoded || decoded.type !== 'npub') {
      return null
    }
    const rawHex =
      typeof decoded.data === 'string'
        ? decoded.data
        : Buffer.from(decoded.data as Uint8Array).toString('hex')
    const hexPubkey = (rawHex ?? '').toLowerCase().replace(/^0x/, '')

    if (
      !hexPubkey ||
      !/^[0-9a-f]+$/.test(hexPubkey) ||
      (hexPubkey.length !== 64 && hexPubkey.length !== 65)
    ) {
      return null
    }

    await this.connect()
    if (!this.ndk) return null

    const filter = {
      kinds: [0 as NDKKind],
      authors: [hexPubkey],
      limit: 10
    }
    const FETCH_KIND0_TIMEOUT_MS = 15000
    const events = await Promise.race([
      this.ndk.fetchEvents(filter, { groupable: false }),
      new Promise<Set<NDKEvent>>((resolve) => {
        setTimeout(() => resolve(new Set()), FETCH_KIND0_TIMEOUT_MS)
      })
    ])

    const event =
      events.size === 0
        ? null
        : Array.from(events).sort(
            (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
          )[0]

    if (!event?.content) return null

    try {
      const content = JSON.parse(event.content) as Record<string, unknown>
      const displayName =
        typeof content.name === 'string'
          ? content.name
          : typeof content.display_name === 'string'
            ? content.display_name
            : typeof content.username === 'string'
              ? content.username
              : undefined
      const picture =
        typeof content.picture === 'string' ? content.picture : undefined
      if (!displayName && !picture) return null
      return { displayName, picture }
    } catch {
      return null
    }
  }

  static async generateNostrKeys(): Promise<NostrKeys> {
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
    const toProcess = batch.filter((m) => !this.processedMessageIds.has(m.id))
    toProcess.forEach((m) => this.processedMessageIds.add(m.id))

    if (toProcess.length > 0 && this._callback) {
      try {
        const result = this._callback(toProcess)
        if (result instanceof Promise) {
          await result
        }
      } catch {
        toast.error('Failed to process message')
      }
    }

    this.isProcessingQueue = false
    if (this.eventQueue.length > 0) {
      setTimeout(() => this.processQueue(), PROCESSING_INTERVAL_MS)
    }
  }

  private _callback?: (messages: NostrMessage[]) => void | Promise<void>

  async subscribeToKind1059(
    recipientNsec: string,
    recipientNpub: string,
    _callback: (messages: NostrMessage[]) => void | Promise<void>,
    limit?: number,
    since?: number,
    onEOSE?: (nsec: string) => void
  ): Promise<void> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    let recipientSecretNostrKey: Uint8Array | string
    let recipientPubKeyHex: string
    try {
      const decodedNsec = nip19.decode(recipientNsec)
      const decodedNpub = nip19.decode(recipientNpub)
      if (!decodedNsec?.data || !decodedNpub?.data) return
      recipientSecretNostrKey = decodedNsec.data as Uint8Array
      recipientPubKeyHex =
        typeof decodedNpub.data === 'string'
          ? decodedNpub.data
          : Buffer.from(decodedNpub.data as Uint8Array).toString('hex')
      // NDK requires non-empty filter; avoid "No filters to merge" by ensuring valid hex pubkey (64 chars)
      if (
        !recipientPubKeyHex ||
        typeof recipientPubKeyHex !== 'string' ||
        recipientPubKeyHex.length !== 64 ||
        !/^[0-9a-fA-F]+$/.test(recipientPubKeyHex)
      ) {
        return
      }
    } catch {
      return
    }

    this.setLoading(true)
    this._callback = _callback

    const TWO_DAYS = 48 * 60 * 60
    const sinceTimestamp = since && since > 0 ? since - TWO_DAYS : undefined

    const subscriptionQuery = {
      kinds: [1059 as NDKKind],
      '#p': [recipientPubKeyHex],
      ...(limit && { limit }),
      ...(sinceTimestamp !== undefined && { since: sinceTimestamp })
    }

    let subscription: NDKSubscription | undefined
    try {
      subscription = this.ndk?.subscribe(subscriptionQuery, {
        closeOnEose: false
      }) as NDKSubscription | undefined
    } catch {
      this.setLoading(false)
      return
    }
    if (subscription) {
      this.activeSubscriptions.add(subscription)
    }

    subscription?.on('event', async (event) => {
      try {
        const rawEvent = await event.toNostrEvent()
        const rawId = (rawEvent as { id?: string }).id

        if (rawId && this.processedRawEventIds.has(rawId)) return

        let unwrappedEvent: {
          id: string
          content: string
          pubkey: string
          created_at?: number
        }
        try {
          unwrappedEvent = nip59.unwrapEvent(
            rawEvent as unknown as Event,
            recipientSecretNostrKey as Uint8Array
          )
        } catch {
          return
        }

        if (rawId) {
          if (this.processedRawEventIds.size >= MAX_PROCESSED_RAW_IDS) {
            const entries = Array.from(this.processedRawEventIds)
            entries
              .slice(0, Math.floor(entries.length / 2))
              .forEach((id) => this.processedRawEventIds.delete(id))
          }
          this.processedRawEventIds.add(rawId)
        }

        if (!this.processedMessageIds.has(unwrappedEvent.id)) {
          if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
            this.eventQueue.shift()
          }
          const message = {
            id: unwrappedEvent.id,
            content: unwrappedEvent,
            created_at: unwrappedEvent.created_at ?? 0,
            pubkey: event.pubkey
          }
          this.eventQueue.push(message)
          this.processQueue()
        }
      } catch {
        // Intentionally ignored: malformed wrapped events should not crash the subscription
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

  async flushQueue(): Promise<void> {
    while (this.eventQueue.length > 0 && this._callback) {
      await this.processQueue()
      // Small delay between batches to avoid blocking the JS thread
      await new Promise((r) => setTimeout(r, FLUSH_QUEUE_DELAY_MS))
    }
  }

  async closeAllSubscriptions() {
    for (const subscription of this.activeSubscriptions) {
      subscription.stop()
    }
    this.activeSubscriptions.clear()
    this.eventQueue = []
    this.processedRawEventIds.clear()
    this._callback = undefined

    // Disconnect every relay in the pool to release WebSocket connections and
    // their underlying OS threads. Without this, each startSync/stopSync cycle
    // leaks an NDK instance with live relay connections, eventually exhausting
    // the Android thread limit (pthread_create OOM).
    if (this.ndk) {
      for (const relay of this.ndk.pool.relays.values()) {
        try {
          relay.disconnect()
        } catch {
          // Intentionally ignored: relay may already be disconnected or in invalid state
        }
      }
    }
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

  // 20 second timeout per relay for publish operations
  private static readonly PUBLISH_TIMEOUT_MS = 20000

  /**
   * Request deletion of events from relays (NIP-09). Sends a kind 5 event.
   * Only events authored by the signer can be deleted by relays.
   * eventIds should be 64-char hex Nostr event ids.
   */
  async requestDeletion(eventIds: string[], deviceNsec: string): Promise<void> {
    const hexIds = eventIds.filter(
      (id) => typeof id === 'string' && /^[a-f0-9]{64}$/i.test(id)
    )
    if (hexIds.length === 0) return

    const decoded = nip19.decode(deviceNsec)
    if (!decoded?.data) throw new Error('Invalid nsec')
    const secretKey = decoded.data as Uint8Array
    const signer = new NDKPrivateKeySigner(secretKey)

    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    const tempNdk = new NDK({ explicitRelayUrls: this.relays })
    tempNdk.signer = signer
    const event = new NDKEvent(tempNdk, {
      kind: 5,
      content: '',
      tags: hexIds.map((id) => ['e', id])
    })
    await event.sign(signer)
    event.ndk = this.ndk
    await this.publishEvent(event)
  }

  async publishEvent(event: NDKEvent): Promise<void> {
    if (!this.ndk) {
      await this.connect()
    }

    if (!this.ndk) {
      throw new Error('Failed to initialize NDK')
    }

    const connectedRelays = Array.from(this.ndk.pool.relays.keys())

    if (connectedRelays.length === 0) {
      throw new Error('No relays connected')
    }

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

    const publishPromises = connectedRelays.map(async (url) => {
      const relay = this.ndk?.pool.relays.get(url)
      if (!relay) {
        return { url, success: false as const, error: 'Relay not found' }
      }

      try {
        // Add timeout to prevent indefinite hanging
        await Promise.race([
          relay.publish(event),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Publish timeout after ${NostrAPI.PUBLISH_TIMEOUT_MS}ms`
                  )
                ),
              NostrAPI.PUBLISH_TIMEOUT_MS
            )
          )
        ])
        return { url, success: true as const }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        return { url, success: false as const, error: errorMsg }
      }
    })

    const results = await Promise.all(publishPromises)
    const successfulPublishes = results.filter((r) => r.success)

    if (successfulPublishes.length === 0) {
      const errors = results.map((r) => `${r.url}: ${r.error}`).join('; ')
      toast.error('Failed to publish to any relay', {
        description: errors
      })
      throw new Error(`Failed to publish to any relay: ${errors}`)
    }
  }
}
