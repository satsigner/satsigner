import { Buffer } from 'buffer'

import type { NDKKind, NDKSubscription } from '@nostr-dev-kit/ndk'
import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import { type Event, nip17, nip19, nip59 } from 'nostr-tools'

import {
  FLUSH_QUEUE_DELAY_MS,
  MAX_PROCESSED_RAW_IDS,
  MAX_QUEUE_SIZE,
  PROCESSING_INTERVAL_MS
} from '@/constants/nostr'
import type {
  NostrKeys,
  NostrKind0Profile,
  NostrMessage
} from '@/types/models/Nostr'
import { randomKey } from '@/utils/crypto'
import { getPubKeyHexFromNpub, getSecretFromNsec } from '@/utils/nostr'

/** NDK waits for this long then continues connecting in the background */
const NDK_CONNECT_TIMEOUT_MS = 20000

function createMobileNdk(explicitRelayUrls: string[]): NDK {
  return new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls
  })
}

function getProfileFromKind0Content(
  contentJson: string
): NostrKind0Profile | null {
  try {
    const content = JSON.parse(contentJson) as Record<string, unknown>
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
    if (!displayName && !picture) {
      return null
    }
    return { displayName, picture }
  } catch {
    return null
  }
}

type UnwrappedKind1059Event = {
  id: string
  content: string
  pubkey: string
  created_at?: number
}

function unwrapNip59EventOrNull(
  rawEvent: Event,
  secretKey: Uint8Array
): UnwrappedKind1059Event | null {
  try {
    return nip59.unwrapEvent(rawEvent, secretKey) as UnwrappedKind1059Event
  } catch {
    return null
  }
}

export class NostrAPI {
  private ndk: NDK | null = null
  private activeSubscriptions = new Set<NDKSubscription>()
  private processedMessageIds = new Set<string>()
  private processedRawEventIds = new Set<string>()
  private eventQueue: NostrMessage[] = []
  private isProcessingQueue = false
  private readonly BATCH_SIZE = 10
  private onLoadingChange?: (isLoading: boolean) => void
  private relays: string[]

  constructor(relays: string[]) {
    this.relays = relays
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

  setLoadingCallback(handler: (isLoading: boolean) => void) {
    this.onLoadingChange = handler
  }

  private setLoading(loading: boolean) {
    this.onLoadingChange?.(loading)
  }

  async connect() {
    if (!this.ndk) {
      this.ndk = createMobileNdk(this.relays)
    }

    await this.ndk.connect(NDK_CONNECT_TIMEOUT_MS)

    if (!this.ndk.pool) {
      throw new Error('NDK pool not initialized')
    }

    const connected = this.ndk.pool.connectedRelays()
    const connectedUrls = connected.map((r) => r.url)

    if (connectedUrls.length === 0) {
      throw new Error(
        'No relays could be connected. Please check your relay URLs and internet connection.'
      )
    }

    const relayStatus = await Promise.all(
      connectedUrls.map(async (url) => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const relay = this.ndk?.pool.relays.get(url)
            if (!relay) {
              return { status: 'not_found', url }
            }

            const testEvent = await this.ndk?.fetchEvent(
              { kinds: [1], limit: 1 },
              { closeOnEose: true, relayUrls: [url] }
            )

            return { status: 'connected', testEvent: testEvent !== null, url }
          } catch {
            if (attempt === 2) {
              return { status: 'error', url }
            }
            await new Promise((resolve) => {
              setTimeout(resolve, 1000 * (attempt + 1))
            })
          }
        }
        return { status: 'error', url }
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
   * Lightweight connect for publishing — establishes the NDK/pool connection
   * without the slow per-relay event-fetch verification that connect() performs.
   * Use this when you only need to publish (not subscribe or verify relay health).
   */
  async connectForPublish(timeoutMs = 10000): Promise<void> {
    if (!this.ndk) {
      this.ndk = createMobileNdk(this.relays)
    }

    await this.ndk.connect(timeoutMs)

    if (!this.ndk.pool) {
      throw new Error('NDK pool not initialized')
    }

    if (this.ndk.pool.connectedRelays().length === 0) {
      throw new Error(
        'No relays could be connected. Please check your relay URLs and internet connection.'
      )
    }
  }

  /**
   * Fetches kind 0 (metadata) event for the given npub from relays.
   * Returns display name (name) and picture URL if available.
   * npub must decode to a 64-char hex pubkey (not a Bitcoin address or other format).
   */
  async fetchKind0(npub: string): Promise<NostrKind0Profile | null> {
    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) {
      return null
    }

    await this.connect()
    if (!this.ndk) {
      return null
    }

    const filter = {
      authors: [hexPubkey],
      kinds: [0 as NDKKind],
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
        : Array.from(events).toSorted(
            (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
          )[0]

    if (!event?.content) {
      return null
    }

    return getProfileFromKind0Content(event.content)
  }

  static async generateNostrKeys(): Promise<NostrKeys> {
    const randomHex = await randomKey(32)
    const randomBytesArray = new Uint8Array(Buffer.from(randomHex, 'hex'))

    // Use the private key directly with NDKPrivateKeySigner
    const signer = new NDKPrivateKeySigner(randomBytesArray)
    const user = await signer.user()
    const nsec = nip19.nsecEncode(randomBytesArray)
    const { npub } = user

    return {
      npub,
      nsec,
      secretNostrKey: randomBytesArray
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true
    const batch = this.eventQueue.splice(0, this.BATCH_SIZE)
    const toProcess = batch.filter((m) => !this.processedMessageIds.has(m.id))
    for (const m of toProcess) {
      this.processedMessageIds.add(m.id)
    }

    if (toProcess.length > 0 && this._callback) {
      try {
        const result = this._callback(toProcess)
        if (result instanceof Promise) {
          await result
        }
      } catch {
        // Callback error; caller is responsible for handling and surfacing to user
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
    if (!this.ndk) {
      throw new Error('Failed to connect to relays')
    }

    const recipientSecretNostrKey = getSecretFromNsec(recipientNsec)
    const recipientPubKeyHex = getPubKeyHexFromNpub(recipientNpub)
    if (!recipientSecretNostrKey || !recipientPubKeyHex) {
      return
    }

    this.setLoading(true)
    this._callback = _callback

    const TWO_DAYS = 48 * 60 * 60
    const sinceTimestamp = since && since > 0 ? since - TWO_DAYS : undefined

    const subscriptionQuery = {
      '#p': [recipientPubKeyHex],
      kinds: [1059 as NDKKind],
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

        if (rawId && this.processedRawEventIds.has(rawId)) {
          return
        }

        const unwrappedEvent = unwrapNip59EventOrNull(
          rawEvent as unknown as Event,
          recipientSecretNostrKey
        )
        if (!unwrappedEvent) {
          return
        }

        if (rawId) {
          if (this.processedRawEventIds.size >= MAX_PROCESSED_RAW_IDS) {
            const entries = Array.from(this.processedRawEventIds)
            for (const id of entries.slice(0, Math.floor(entries.length / 2))) {
              this.processedRawEventIds.delete(id)
            }
          }
          this.processedRawEventIds.add(rawId)
        }

        if (!this.processedMessageIds.has(unwrappedEvent.id)) {
          if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
            this.eventQueue.shift()
          }
          const message = {
            content: unwrappedEvent,
            created_at: unwrappedEvent.created_at ?? 0,
            id: unwrappedEvent.id,
            pubkey: event.pubkey
          }
          this.eventQueue.push(message)
          this.processQueue()
        }
      } catch {
        // TODO: log this error; malformed wrapped events should not crash the subscription
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
      await new Promise((resolve) => {
        setTimeout(resolve, FLUSH_QUEUE_DELAY_MS)
      })
    }
  }

  closeAllSubscriptions() {
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
          // TODO: log this error; relay may already be disconnected or in invalid state
        }
      }
    }
  }

  createKind1059(
    nsec: string,
    recipientNpub: string,
    content: string
  ): NDKEvent {
    const secretNostrKey = getSecretFromNsec(nsec)
    const recipientPubKeyHex = getPubKeyHexFromNpub(recipientNpub)
    if (!secretNostrKey || !recipientPubKeyHex) {
      throw new Error('Invalid nsec or recipient npub')
    }
    const encodedContent = unescape(encodeURIComponent(content))

    const wrap = nip17.wrapEvent(
      secretNostrKey,
      { publicKey: recipientPubKeyHex },
      encodedContent
    )
    const tempNdk = new NDK({
      autoConnectUserRelays: false,
      enableOutboxModel: false
    })
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
    if (hexIds.length === 0) {
      return
    }

    const secretKey = getSecretFromNsec(deviceNsec)
    if (!secretKey) {
      throw new Error('Invalid nsec')
    }
    const signer = new NDKPrivateKeySigner(secretKey)

    await this.connect()
    if (!this.ndk) {
      throw new Error('Failed to connect to relays')
    }

    const tempNdk = createMobileNdk(this.relays)
    tempNdk.signer = signer
    const event = new NDKEvent(tempNdk, {
      content: '',
      kind: 5,
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

    const connectedRelayUrls = this.ndk.pool.connectedRelays().map((r) => r.url)

    if (connectedRelayUrls.length === 0) {
      throw new Error('No relays connected')
    }

    if (event.ndk !== this.ndk) {
      event.ndk = this.ndk
    }
    if (!event.sig) {
      const { signer } = this.ndk
      if (!signer) {
        throw new Error('No signer available for event')
      }
      await event.sign(signer)
    }

    const publishPromises = connectedRelayUrls.map(async (url) => {
      const relay = this.ndk?.pool.relays.get(url)
      if (!relay) {
        return { error: 'Relay not found', success: false as const, url }
      }

      try {
        // Add timeout to prevent indefinite hanging
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  `Publish timeout after ${NostrAPI.PUBLISH_TIMEOUT_MS}ms`
                )
              ),
            NostrAPI.PUBLISH_TIMEOUT_MS
          )
        })
        await Promise.race([relay.publish(event), timeoutPromise])
        return { success: true as const, url }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        return { error: errorMsg, success: false as const, url }
      }
    })

    const results = await Promise.all(publishPromises)
    const successfulPublishes = results.filter((r) => r.success)

    if (successfulPublishes.length === 0) {
      const errors = results.map((r) => `${r.url}: ${r.error}`).join('; ')
      throw new Error(`Failed to publish to any relay: ${errors}`)
    }
  }
}
