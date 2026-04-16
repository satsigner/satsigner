import { Buffer } from 'buffer'

import NetInfo from '@react-native-community/netinfo'
import type { NDKKind, NDKSubscription } from '@nostr-dev-kit/ndk'
import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import { type Event, nip17, nip19, nip59 } from 'nostr-tools'

import {
  FLUSH_QUEUE_DELAY_MS,
  MAX_PROCESSED_RAW_IDS,
  MAX_QUEUE_SIZE,
  NOSTR_RELAY_REACHABILITY_TEST_MS,
  PROCESSING_INTERVAL_MS,
  PROFILE_CACHE_TTL_SECS
} from '@/constants/nostr'
import {
  cacheEvents,
  cacheProfile,
  getCachedEvent,
  getCachedNotes,
  getCachedProfile,
  getNewestCachedTimestamp
} from '@/db/nostrCache'
import type {
  NostrKeys,
  NostrKind0Profile,
  NostrMessage
} from '@/types/models/Nostr'
import {
  type NostrRelayConnectionInfo,
  type RelayConnectionDetail
} from '@/types/models/NostrIdentity'
import { randomKey } from '@/utils/crypto'
import { getPubKeyHexFromNpub, getSecretFromNsec } from '@/utils/nostr'

export type SignedKind1NostrEvent = {
  content: string
  created_at: number
  id: string
  kind: number
  pubkey: string
  sig: string
  tags: string[][]
}

/** NDK waits for this long then continues connecting in the background */
const NDK_CONNECT_TIMEOUT_MS = 20000

function createMobileNdk(explicitRelayUrls: string[]): NDK {
  return new NDK({
    autoConnectUserRelays: false,
    enableOutboxModel: false,
    explicitRelayUrls
  })
}

function testSingleRelay(
  url: string,
  timeoutMs: number
): Promise<RelayConnectionDetail> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        ws.close()
      } catch {
        // already closed
      }
      resolve({ url, connected: false, error: 'timeout' })
    }, timeoutMs)

    const ws = new WebSocket(url)

    ws.onopen = () => {
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        // already closed
      }
      resolve({ url, connected: true })
    }

    ws.onerror = (ev) => {
      clearTimeout(timer)
      const message =
        (ev as unknown as { message?: string }).message || 'connection error'
      try {
        ws.close()
      } catch {
        // already closed
      }
      resolve({ url, connected: false, error: message })
    }

    ws.onclose = (event: CloseEvent) => {
      clearTimeout(timer)
      if (event.code !== 1000 && event.code !== 1005) {
        const reason =
          event.reason || `closed with code ${event.code}`
        resolve({ url, connected: false, error: reason })
      }
    }
  })
}

export async function testNostrRelaysReachable(
  relayUrls: string[]
): Promise<NostrRelayConnectionInfo> {
  if (relayUrls.length === 0) {
    return { status: 'disconnected', reason: 'no_relays' }
  }

  const netState = await NetInfo.fetch()
  if (netState.isConnected === false) {
    return {
      status: 'disconnected',
      reason: 'no_internet'
    }
  }

  const relayDetails = await Promise.all(
    relayUrls.map((url) =>
      testSingleRelay(url, NOSTR_RELAY_REACHABILITY_TEST_MS)
    )
  )

  const anyConnected = relayDetails.some((r) => r.connected)

  return {
    status: anyConnected ? 'connected' : 'disconnected',
    reason: anyConnected ? undefined : 'all_failed',
    relayDetails
  }
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
    const nip05 = typeof content.nip05 === 'string' ? content.nip05 : undefined
    const lud16 = typeof content.lud16 === 'string' ? content.lud16 : undefined
    if (!displayName && !picture && !nip05 && !lud16) {
      return null
    }
    return { displayName, lud16, nip05, picture }
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
  ownPubkeys: string[] = []

  constructor(relays: string[], ownPubkeys: string[] = []) {
    this.relays = relays?.length ? relays : []
    this.ownPubkeys = ownPubkeys
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

    return true
  }

  /**
   * Lightweight connect — initialises the NDK pool and starts WebSocket
   * connections. NDK routes subscriptions to relays as they come online, so
   * we do NOT gate on connectedRelays().length here; the per-fetch timeout
   * handles the case where nothing connects in time.
   */
  async connectForPublish(timeoutMs = 10000): Promise<void> {
    if (!this.ndk) {
      this.ndk = createMobileNdk(this.relays)
    }

    await this.ndk.connect(timeoutMs)

    if (!this.ndk.pool) {
      throw new Error('NDK pool not initialized')
    }
  }


  /**
   * Fetches kind 0 (metadata) for a 64-char hex pubkey (lowercase).
   * Checks SQLite profile cache first; only hits relays when stale or missing.
   */
  async fetchKind0ByPubkeyHex(
    hexPubkey: string
  ): Promise<NostrKind0Profile | null> {
    const pk = hexPubkey.toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(pk)) {
      return null
    }

    const cached = getCachedProfile(pk)
    const now = Math.floor(Date.now() / 1000)
    if (cached && now - cached.cached_at < PROFILE_CACHE_TTL_SECS) {
      return {
        displayName: cached.displayName,
        lud16: cached.lud16,
        nip05: cached.nip05,
        picture: cached.picture
      }
    }

    await this.connect()
    if (!this.ndk) {
      return cached
        ? {
            displayName: cached.displayName,
            lud16: cached.lud16,
            nip05: cached.nip05,
            picture: cached.picture
          }
        : null
    }

    const filter = {
      authors: [pk],
      kinds: [0 as NDKKind],
      limit: 10
    }
    const FETCH_KIND0_TIMEOUT_MS = 15000
    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter as Record<string, unknown>,
      FETCH_KIND0_TIMEOUT_MS
    )

    const event =
      events.size === 0
        ? null
        : Array.from(events).toSorted(
            (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
          )[0]

    if (!event?.content) {
      return cached
        ? {
            displayName: cached.displayName,
            lud16: cached.lud16,
            nip05: cached.nip05,
            picture: cached.picture
          }
        : null
    }

    const profile = getProfileFromKind0Content(event.content)
    if (profile) {
      cacheProfile(pk, profile, event.id, event.created_at ?? 0)
    }

    return profile
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
    return this.fetchKind0ByPubkeyHex(hexPubkey)
  }

  /**
   * Latest kind 3 (NIP-02 contact list) for this npub; returns followed
   * pubkeys in tag order (64-char hex, lowercase), excluding duplicates and self.
   */
  async fetchKind3FollowingPubkeys(npub: string): Promise<string[]> {
    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) {
      return []
    }

    await this.connect()
    if (!this.ndk) {
      return []
    }

    const filter = {
      authors: [hexPubkey],
      kinds: [3 as NDKKind],
      limit: 40
    }
    const FETCH_KIND3_TIMEOUT_MS = 15000
    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter as Record<string, unknown>,
      FETCH_KIND3_TIMEOUT_MS
    )

    if (events.size === 0) {
      return []
    }

    const sorted = Array.from(events).toSorted(
      (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
    )
    const [latest] = sorted
    if (!latest) {
      return []
    }

    const ordered: string[] = []
    const seen = new Set<string>()

    for (const tag of latest.tags) {
      if (
        tag[0] === 'p' &&
        typeof tag[1] === 'string' &&
        /^[0-9a-fA-F]{64}$/.test(tag[1])
      ) {
        const pk = tag[1].toLowerCase()
        if (!seen.has(pk) && pk !== hexPubkey) {
          seen.add(pk)
          ordered.push(pk)
        }
      }
    }

    return ordered
  }

  async fetchNotes(
    npub: string,
    limit = 20,
    until?: number,
    kinds: number[] = [1]
  ): Promise<
    {
      id: string
      content: string
      pubkey: string
      kind: number
      tags: string[][]
      created_at: number
    }[]
  > {
    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) return []

    const isKind1Only =
      kinds.length === 0 || (kinds.length === 1 && kinds[0] === 1)
    let cached: { id: string; content: string; pubkey: string; kind: number; tags: string[][]; created_at: number }[] = []
    if (isKind1Only) {
      cached = getCachedNotes(hexPubkey, limit, until).map((e) => ({
        id: e.event_id,
        content: e.content,
        created_at: e.created_at,
        kind: e.kind,
        pubkey: e.pubkey,
        tags: e.tags
      }))
    }

    await this.connectForPublish()
    if (!this.ndk) return cached

    const kindList = kinds.length > 0 ? kinds : [1]
    const filter: Record<string, unknown> = {
      authors: [hexPubkey],
      kinds: kindList.map((k) => k as NDKKind),
      limit
    }
    if (until) {
      filter.until = until
    } else if (isKind1Only) {
      const since = getNewestCachedTimestamp(1, hexPubkey)
      if (since) {
        filter.since = since + 1
      }
    }

    const FETCH_NOTES_TIMEOUT_MS = 15000
    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter,
      FETCH_NOTES_TIMEOUT_MS
    )

    const fresh = Array.from(events)
      .toSorted((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      .map((e) => ({
        id: e.id,
        ...NostrAPI.formatNdkEvent(e)
      }))

    if (fresh.length > 0) {
      cacheEvents(fresh, this.ownPubkeys)
    }

    if (!isKind1Only) return fresh

    const idSet = new Set(fresh.map((n) => n.id))
    const merged = [
      ...fresh,
      ...cached.filter((n) => !idSet.has(n.id))
    ].toSorted((a, b) => b.created_at - a.created_at)

    return merged.slice(0, limit)
  }

  /**
   * Notes from pubkeys in the user's latest kind-3 follow list (NIP-02).
   * `kinds` defaults to short text notes (kind 1). Pass multiple kinds for
   * reposts (6, 16) etc. — see https://nostr.dev/ai-reference/
   * Authors list is capped for relay compatibility.
   */
  async fetchFollowingTimelineNotes(
    npub: string,
    limit = 20,
    until?: number,
    kinds: number[] = [1]
  ): Promise<
    {
      id: string
      content: string
      pubkey: string
      kind: number
      tags: string[][]
      created_at: number
    }[]
  > {
    const following = await this.fetchKind3FollowingPubkeys(npub)
    if (following.length === 0) {
      return []
    }

    await this.connectForPublish()
    if (!this.ndk) {
      return []
    }

    const MAX_AUTHORS = 200
    const authors = following.slice(0, MAX_AUTHORS)

    const kindList = kinds.length > 0 ? kinds : [1]
    const filter: Record<string, unknown> = {
      authors,
      kinds: kindList.map((k) => k as NDKKind),
      limit
    }
    if (until) {
      filter.until = until
    }

    const FETCH_FEED_TIMEOUT_MS = 15000
    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter,
      FETCH_FEED_TIMEOUT_MS
    )

    const results = Array.from(events)
      .toSorted((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      .map((e) => ({
        id: e.id,
        ...NostrAPI.formatNdkEvent(e)
      }))

    if (results.length > 0) {
      cacheEvents(results, this.ownPubkeys)
    }

    return results
  }

  private static formatNdkEvent(event: NDKEvent) {
    return {
      content: event.content,
      created_at: event.created_at ?? 0,
      kind: event.kind ?? 1,
      pubkey: event.pubkey,
      tags: event.tags.map((tag) =>
        tag.filter((v): v is string => typeof v === 'string')
      )
    }
  }

  /**
   * Subscribe-based single-event fetch. Keeps the subscription open so that
   * events arriving after relays finish connecting are still captured.
   * Resolves with the first matching event or null after timeoutMs.
   */
  private static fetchWithTimeout(
    ndk: NDK,
    filter: Record<string, unknown>,
    timeoutMs: number
  ): Promise<NDKEvent | null> {
    return new Promise((resolve) => {
      let settled = false
      const sub = ndk.subscribe(filter as never, { closeOnEose: false })

      const finish = (result: NDKEvent | null) => {
        if (settled) return
        settled = true
        sub.stop()
        resolve(result)
      }

      sub.on('event', (event: NDKEvent) => finish(event))
      sub.on('eose', () => {
        if (ndk.pool.connectedRelays().length > 0) {
          finish(null)
        }
      })
      setTimeout(() => finish(null), timeoutMs)
    })
  }

  /**
   * Subscribe-based multi-event fetch. Collects events until EOSE from
   * connected relays or timeout, whichever comes first.
   */
  private static fetchManyWithTimeout(
    ndk: NDK,
    filter: Record<string, unknown>,
    timeoutMs: number
  ): Promise<Set<NDKEvent>> {
    return new Promise((resolve) => {
      let settled = false
      const collected = new Set<NDKEvent>()
      const sub = ndk.subscribe(filter as never, { closeOnEose: false })

      const finish = () => {
        if (settled) return
        settled = true
        sub.stop()
        resolve(collected)
      }

      sub.on('event', (event: NDKEvent) => {
        collected.add(event)
      })
      sub.on('eose', () => {
        if (ndk.pool.connectedRelays().length > 0) {
          finish()
        }
      })
      setTimeout(finish, timeoutMs)
    })
  }

  static readonly INDEXING_RELAYS = [
    'wss://relay.nostr.band',
    'wss://relay.primal.net',
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://relay.snort.social',
    'wss://purplepag.es'
  ]

  async fetchEvent(
    eventIdHex: string
  ): Promise<{
    content: string
    pubkey: string
    kind: number
    tags: string[][]
    created_at: number
  } | null> {
    const cached = getCachedEvent(eventIdHex)
    if (cached) {
      return {
        content: cached.content,
        created_at: cached.created_at,
        kind: cached.kind,
        pubkey: cached.pubkey,
        tags: cached.tags
      }
    }

    await this.connectForPublish()
    if (!this.ndk) return null

    const filter = { ids: [eventIdHex], limit: 1 }
    const poolEvent = await NostrAPI.fetchWithTimeout(this.ndk, filter, 15000)
    if (!poolEvent) return null

    const formatted = NostrAPI.formatNdkEvent(poolEvent)
    cacheEvents(
      [{ id: poolEvent.id, ...formatted }],
      this.ownPubkeys
    )
    return formatted
  }

  static async fetchEventFromRelays(
    eventIdHex: string,
    relayUrls: string[],
    ownPubkeys: string[] = []
  ): Promise<{
    content: string
    pubkey: string
    kind: number
    tags: string[][]
    created_at: number
  } | null> {
    if (relayUrls.length === 0) return null

    const tempNdk = createMobileNdk(relayUrls)
    try {
      await tempNdk.connect(8000)

      const filter = { ids: [eventIdHex], limit: 1 }
      const event = await NostrAPI.fetchWithTimeout(tempNdk, filter, 15000)
      if (!event) return null

      const formatted = NostrAPI.formatNdkEvent(event)
      cacheEvents([{ id: event.id, ...formatted }], ownPubkeys)
      return formatted
    } finally {
      try {
        tempNdk.pool?.removeAllListeners?.()
        for (const relay of tempNdk.pool?.relays.values() ?? []) {
          relay.disconnect()
        }
      } catch {
        // cleanup best-effort
      }
    }
  }

  private static ndkEventToStorableRecord(event: NDKEvent) {
    return {
      id: event.id,
      pubkey: event.pubkey,
      kind: event.kind ?? 0,
      content: event.content,
      created_at: event.created_at ?? 0,
      tags: event.tags.map((tag) =>
        tag.filter((v): v is string => typeof v === 'string')
      ),
      sig: event.sig
    }
  }

  /** Pretty-printed JSON for a single event by id (e.g. kind 9735 zap receipt). */
  static async fetchEventJsonFromRelays(
    eventIdHex: string,
    relayUrls: string[]
  ): Promise<string | null> {
    if (relayUrls.length === 0) return null

    const tempNdk = createMobileNdk(relayUrls)
    try {
      await tempNdk.connect(8000)

      const filter = { ids: [eventIdHex], limit: 1 }
      const event = await NostrAPI.fetchWithTimeout(tempNdk, filter, 15000)
      if (!event) return null
      return JSON.stringify(NostrAPI.ndkEventToStorableRecord(event), null, 2)
    } finally {
      try {
        tempNdk.pool?.removeAllListeners?.()
        for (const relay of tempNdk.pool?.relays.values() ?? []) {
          relay.disconnect()
        }
      } catch {
        // cleanup best-effort
      }
    }
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

  /**
   * Build and sign a kind 1 note locally without publishing (e.g. copy / QR for
   * manual relay submission).
   */
  static async signKind1Note(
    nsec: string,
    content: string,
    tags?: string[][]
  ): Promise<SignedKind1NostrEvent> {
    const secretKey = getSecretFromNsec(nsec)
    if (!secretKey) {
      throw new Error('Invalid nsec')
    }

    const signer = new NDKPrivateKeySigner(secretKey)
    const tempNdk = createMobileNdk([])
    tempNdk.signer = signer
    const event = new NDKEvent(tempNdk, {
      content,
      kind: 1,
      tags: tags ?? []
    })

    await event.sign(signer)
    if (!event.sig) {
      throw new Error('Failed to sign note')
    }

    return {
      content: event.content,
      created_at: event.created_at ?? 0,
      id: event.id,
      kind: event.kind ?? 1,
      pubkey: event.pubkey,
      sig: event.sig,
      tags: event.tags.map((tag) =>
        tag.filter((v): v is string => typeof v === 'string')
      )
    }
  }

  async publishNote(
    nsec: string,
    content: string,
    tags?: string[][]
  ): Promise<string> {
    const secretKey = getSecretFromNsec(nsec)
    if (!secretKey) {
      throw new Error('Invalid nsec')
    }

    const signer = new NDKPrivateKeySigner(secretKey)
    await this.connectForPublish()
    if (!this.ndk) {
      throw new Error('Failed to connect to relays')
    }

    this.ndk.signer = signer
    const event = new NDKEvent(this.ndk, {
      content,
      kind: 1,
      tags: tags ?? []
    })

    await event.sign(signer)
    await this.publishEvent(event)
    return event.id
  }

  async publishEvent(event: NDKEvent): Promise<void> {
    if (!this.ndk) {
      await this.connect()
    }

    if (!this.ndk) {
      throw new Error('Failed to initialize NDK')
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

    const allRelayUrls = Array.from(this.ndk.pool.relays.keys())
    if (allRelayUrls.length === 0) {
      throw new Error('No relays in pool')
    }

    const publishPromises = allRelayUrls.map(async (url) => {
      const relay = this.ndk?.pool.relays.get(url)
      if (!relay) {
        return { error: 'Relay not found', success: false as const, url }
      }

      try {
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
