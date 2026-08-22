import { Buffer } from 'buffer'

import NDK, { NDKEvent, NDKKind, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import type { NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk'
import NetInfo from '@react-native-community/netinfo'
import { type Event, nip17, nip19, nip44, verifyEvent } from 'nostr-tools'
import {
  decrypt as nip04Decrypt,
  encrypt as nip04Encrypt
} from 'nostr-tools/nip04'
import { finalizeEvent } from 'nostr-tools/pure'

import {
  NOSTR_NIP17_SEAL_KIND,
  NOSTR_DEFAULT_FETCH_TIMEOUT_MS,
  NOSTR_FLUSH_QUEUE_DELAY_MS,
  NOSTR_MAX_PROCESSED_RAW_IDS,
  NOSTR_MAX_QUEUE_SIZE,
  NOSTR_NDK_CONNECT_TIMEOUT_MS,
  NOSTR_NOTES_FETCH_DEFAULT_LIMIT,
  NOSTR_PROCESSING_INTERVAL_MS,
  NOSTR_PROFILE_CACHE_TTL_SECS,
  NOSTR_PUBLISH_TIMEOUT_MS,
  NOSTR_RELAY_PUBLISH_RACE_TIMEOUT_MS,
  NOSTR_RELAY_REACHABILITY_TEST_MS,
  NOSTR_TEMP_NDK_CONNECT_TIMEOUT_MS
} from '@/constants/nostr'
import {
  cacheEvents,
  getCachedEvent,
  getCachedNotes,
  getCachedProfile,
  getNewestCachedTimestamp
} from '@/db/nostrCache'
import { setNostrFollowCache } from '@/storage/mmkv'
import type {
  NostrKeys,
  NostrKind0Profile,
  NostrMessage,
  NostrPollResponse,
  NostrRelayConnectionInfo,
  NostrSignedKind1Event,
  NostrUnwrappedKind1059Event
} from '@/types/models/Nostr'
import { randomKey } from '@/utils/crypto'
import {
  extractInboxRelayUrls,
  getPubKeyHexFromNpub,
  getSecretFromNsec
} from '@/utils/nostr'
import {
  extractResponseOptionIds,
  NOSTR_POLL_RESPONSE_KIND
} from '@/utils/nostrPoll'
import {
  fetchProfileCoalesced,
  fetchProfilesCoalesced,
  queueProfileFetches
} from '@/utils/nostrProfileFetcher'

import {
  createMobileNdk,
  disconnectNdkPool,
  getOrCreateNdk,
  ndkRegistry,
  resetNdkForRelays
} from './ndkRegistry'

// Re-exported for existing callers (registry now lives in ./ndkRegistry).
export { clearNdkRegistry } from './ndkRegistry'

function normalizeRelayUrl(url: string): string {
  return url.toLowerCase().replace(/\/$/, '')
}

function buildRelayConnectionInfo(
  allUrls: string[],
  connectedUrls: string[]
): NostrRelayConnectionInfo {
  const probeUrls = allUrls.slice(0, 3)
  const connectedNormalized = new Set(connectedUrls.map(normalizeRelayUrl))
  return {
    relayDetails: probeUrls.map((url) => ({
      connected: connectedNormalized.has(normalizeRelayUrl(url)),
      url
    })),
    status: 'connected'
  }
}

export async function reconnectNdkForRelays(
  relayUrls: string[]
): Promise<void> {
  const ndk = resetNdkForRelays(relayUrls)
  await ndk.connect(NOSTR_NDK_CONNECT_TIMEOUT_MS)
}

export async function testNostrRelaysReachable(
  relayUrls: string[]
): Promise<NostrRelayConnectionInfo> {
  if (relayUrls.length === 0) {
    return { reason: 'no_relays', status: 'disconnected' }
  }

  const netState = await NetInfo.fetch()
  if (netState.isConnected === false) {
    return { reason: 'no_internet', status: 'disconnected' }
  }

  // Check the shared registry NDK first — if it has live connections, trust
  // its pool state instead of probing with a fresh NDK (which would race
  // against existing sockets and often report "unreachable" while data flows).
  const registryKey = [...relayUrls].toSorted().join(',')
  const registryNdk = ndkRegistry.get(registryKey)
  if (registryNdk?.pool) {
    const connected = registryNdk.pool.connectedRelays().map((r) => r.url)
    if (connected.length > 0) {
      return buildRelayConnectionInfo(relayUrls, connected)
    }
    // Registry NDK exists but all connections are dead — evict the stale
    // instance and create a fresh one rather than trying to revive it.
    const freshNdk = resetNdkForRelays(relayUrls)
    await freshNdk.connect(NOSTR_RELAY_REACHABILITY_TEST_MS)
    const reconnected = freshNdk.pool?.connectedRelays().map((r) => r.url) ?? []
    if (reconnected.length > 0) {
      return buildRelayConnectionInfo(relayUrls, reconnected)
    }
  }

  // No registry entry yet (first probe before any data fetch) — use a throw-away NDK.
  const probeUrls = relayUrls.slice(0, 3)
  const probeNdk = createMobileNdk(probeUrls)
  await probeNdk.connect(NOSTR_RELAY_REACHABILITY_TEST_MS)
  const connected = probeNdk.pool?.connectedRelays().map((r) => r.url) ?? []

  for (const relay of probeNdk.pool?.relays.values() ?? []) {
    try {
      relay.disconnect()
    } catch {
      // best-effort cleanup
    }
  }

  if (connected.length > 0) {
    return buildRelayConnectionInfo(probeUrls, connected)
  }

  return {
    reason: 'all_failed',
    relayDetails: probeUrls.map((url) => ({
      connected: false,
      error: 'timeout',
      url
    })),
    status: 'disconnected'
  }
}

// NIP-17 unwrap with mandatory sender-authenticity checks. nostr-tools'
// nip59.unwrapEvent only decrypts the two NIP-44 layers and returns the
// rumor: it never verifies the seal's signature nor that the seal and rumor
// pubkeys match, so anyone able to address a gift wrap to a victim (e.g. a
// relay, which learns device npubs from the sync filters) could forge the
// rumor author and impersonate a trusted device. Both checks are MUSTs in
// NIP-17, so events failing them are rejected here.
function unwrapNip59EventOrNull(
  rawEvent: Event,
  secretKey: Uint8Array
): NostrUnwrappedKind1059Event | null {
  try {
    const sealJson = nip44.v2.decrypt(
      rawEvent.content,
      nip44.getConversationKey(secretKey, rawEvent.pubkey)
    )
    const seal = JSON.parse(sealJson) as Event
    if (seal.kind !== NOSTR_NIP17_SEAL_KIND || !verifyEvent(seal)) {
      return null
    }

    const rumorJson = nip44.v2.decrypt(
      seal.content,
      nip44.getConversationKey(secretKey, seal.pubkey)
    )
    const rumor = JSON.parse(rumorJson) as NostrUnwrappedKind1059Event
    if (rumor.pubkey !== seal.pubkey) {
      return null
    }

    return rumor
  } catch {
    return null
  }
}

// Exported for unit tests
export { unwrapNip59EventOrNull }

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
    // Always resolve from the registry so all_failed resets don't leave this
    // instance pinned to an evicted/disconnected NDK.
    this.ndk = getOrCreateNdk(this.relays)

    await this.ndk.connect(NOSTR_NDK_CONNECT_TIMEOUT_MS)

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
  async connectForPublish(timeoutMs = NOSTR_PUBLISH_TIMEOUT_MS): Promise<void> {
    // Always resolve from the registry so all_failed resets don't leave this
    // instance pinned to an evicted/disconnected NDK.
    this.ndk = getOrCreateNdk(this.relays)

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
    if (cached && now - cached.cached_at < NOSTR_PROFILE_CACHE_TTL_SECS) {
      return {
        banner: cached.banner,
        displayName: cached.displayName,
        lud16: cached.lud16,
        nip05: cached.nip05,
        picture: cached.picture
      }
    }

    // Coalesced fetcher: dedupes across screens, retries dead pubkeys against
    // indexer relays, and resolves as soon as relays answer (EOSE-driven).
    const profile = await fetchProfileCoalesced(pk, this.relays)
    if (profile) {
      return profile
    }
    return cached
      ? {
          banner: cached.banner,
          displayName: cached.displayName,
          lud16: cached.lud16,
          nip05: cached.nip05,
          picture: cached.picture
        }
      : null
  }

  /**
   * Fetches kind 0 (metadata) event for the given npub from relays.
   * Returns display name (name) and picture URL if available.
   * npub must decode to a 64-char hex pubkey (not a Bitcoin address or other format).
   */
  fetchKind0(npub: string): Promise<NostrKind0Profile | null> {
    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) {
      return Promise.resolve(null)
    }
    return this.fetchKind0ByPubkeyHex(hexPubkey)
  }

  async fetchCalendarEvents(npub: string): Promise<
    {
      description: string
      end?: number
      id: string
      kind: number
      location?: string
      start: number
      title: string
    }[]
  > {
    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) {
      return []
    }

    await this.connectForPublish()
    if (!this.ndk) {
      return []
    }

    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      {
        authors: [hexPubkey],
        kinds: [31922 as NDKKind],
        limit: 500
      },
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )

    return [...events]
      .flatMap((event) => {
        function getTagValue(name: string): string | undefined {
          return event.tags.find((tag) => tag[0] === name)?.[1]
        }

        const start = Number(getTagValue('start'))
        if (!Number.isFinite(start)) {
          return []
        }

        const endValue = Number(getTagValue('end'))
        const location = getTagValue('location')

        return [
          {
            description: event.content,
            ...(Number.isFinite(endValue) ? { end: endValue } : {}),
            id: event.id,
            kind: event.kind ?? 31922,
            ...(location ? { location } : {}),
            start,
            title: getTagValue('title') ?? getTagValue('summary') ?? 'Untitled'
          }
        ]
      })
      .toSorted((a, b) => a.start - b.start)
  }

  /**
   * Fetches kind 0 (metadata) for multiple pubkeys in a single subscription.
   * Returns a map of hex pubkey → profile; caches each result in SQLite.
   * Pubkeys not found on relays are omitted from the result.
   */
  fetchKind0Batch(
    hexPubkeys: string[]
  ): Promise<Map<string, NostrKind0Profile>> {
    const validKeys = hexPubkeys
      .map((pk) => pk.toLowerCase())
      .filter((pk) => /^[0-9a-f]{64}$/.test(pk))
    if (validKeys.length === 0) {
      return Promise.resolve(new Map())
    }

    // Coalesced fetcher: dedupes in-flight pubkeys across callers, falls back
    // to indexer relays for misses, resolves on EOSE instead of a fixed 15s.
    return fetchProfilesCoalesced(validKeys, this.relays)
  }

  /**
   * Streams kind 0 profiles for many pubkeys: SQLite cache first, then relay
   * batches via the coalescing fetcher. Invokes onBatch after each chunk.
   */
  streamKind0Profiles(
    hexPubkeys: string[],
    onBatch: (profiles: Map<string, NostrKind0Profile>) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const validKeys = hexPubkeys
      .map((pk) => pk.toLowerCase())
      .filter((pk) => /^[0-9a-f]{64}$/.test(pk))
    if (validKeys.length === 0 || signal?.aborted) {
      return Promise.resolve()
    }

    const now = Math.floor(Date.now() / 1000)
    const missing: string[] = []
    const cachedBatch = new Map<string, NostrKind0Profile>()

    for (const pk of validKeys) {
      const cached = getCachedProfile(pk)
      if (cached && now - cached.cached_at < NOSTR_PROFILE_CACHE_TTL_SECS) {
        cachedBatch.set(pk, {
          banner: cached.banner,
          displayName: cached.displayName,
          lud16: cached.lud16,
          nip05: cached.nip05,
          picture: cached.picture
        })
      } else {
        missing.push(pk)
      }
    }

    if (cachedBatch.size > 0 && !signal?.aborted) {
      onBatch(cachedBatch)
    }

    // Coalesced relay fetches with per-chunk delivery; abort stops delivery.
    queueProfileFetches(missing, {
      onBatch: (batch) => {
        if (!signal?.aborted) {
          onBatch(batch)
        }
      },
      relays: this.relays
    })
    return Promise.resolve()
  }

  /**
   * Latest kind 10003 (NIP-51 bookmark list) for this npub.
   * Returns raw tags (public bookmarks) and encrypted content (private bookmarks).
   */
  async fetchBookmarks(npub: string): Promise<{
    tags: string[][]
    content: string
  } | null> {
    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) {
      return null
    }

    await this.connectForPublish()
    if (!this.ndk) {
      return null
    }

    const filter: NDKFilter = {
      authors: [hexPubkey],
      kinds: [NDKKind.BookmarkList],
      limit: 1
    }
    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter,
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )

    if (events.size === 0) {
      return null
    }

    const [latest] = Array.from(events).toSorted(
      (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
    )
    if (!latest) {
      return null
    }

    return { content: latest.content ?? '', tags: latest.tags }
  }

  /**
   * Applies an add/remove bookmark action to the user's kind 10003 list
   * and publishes the updated event to relays.
   */
  async publishBookmarkUpdate(
    npub: string,
    nsec: string,
    action:
      | { type: 'add'; eventId: string; source: 'public' | 'private' }
      | { type: 'remove'; eventId: string }
  ): Promise<void> {
    const secretKey = getSecretFromNsec(nsec)
    if (!secretKey) {
      throw new Error('Invalid nsec')
    }

    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) {
      throw new Error('Invalid npub')
    }

    await this.connectForPublish()
    if (!this.ndk) {
      throw new Error('Failed to connect to relays')
    }

    const existing = await this.fetchBookmarks(npub)
    const { applyBookmarkUpdate } = await import('@/utils/nostrBookmarks')
    const { tags, content } = applyBookmarkUpdate(
      existing,
      action,
      secretKey,
      hexPubkey
    )

    const signer = new NDKPrivateKeySigner(secretKey)
    this.ndk.signer = signer

    const event = new NDKEvent(this.ndk, {
      content,
      kind: NDKKind.BookmarkList,
      tags
    })

    await event.sign(signer)
    await this.publishEvent(event)
  }

  /**
   * Latest kind 3 (NIP-02 contact list) for this npub; returns followed
   * pubkeys in tag order (64-char hex, lowercase), excluding duplicates and self.
   */
  async fetchKind3FollowingPubkeys(npub: string): Promise<{
    connectedRelayCount: number
    kind3Found: boolean
    pubkeys: string[]
    relaysQueried: string[]
  }> {
    const empty = {
      connectedRelayCount: 0,
      kind3Found: false,
      pubkeys: [],
      relaysQueried: this.relays
    }

    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) {
      return empty
    }

    await this.connect()
    if (!this.ndk) {
      return empty
    }

    const connectedRelayCount = this.ndk.pool.connectedRelays().length

    const filter: NDKFilter = {
      authors: [hexPubkey],
      kinds: [NDKKind.Contacts],
      limit: 40
    }
    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter,
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )

    if (events.size === 0) {
      return { ...empty, connectedRelayCount }
    }

    const sorted = Array.from(events).toSorted(
      (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
    )
    const [latest] = sorted
    if (!latest) {
      return { ...empty, connectedRelayCount }
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

    if (ordered.length > 0) {
      setNostrFollowCache(npub, ordered)
    }

    return {
      connectedRelayCount,
      kind3Found: true,
      pubkeys: ordered,
      relaysQueried: this.relays
    }
  }

  async fetchNotes(
    npub: string,
    limit = NOSTR_NOTES_FETCH_DEFAULT_LIMIT,
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
    if (!hexPubkey) {
      return []
    }

    const isKind1Only =
      kinds.length === 0 || (kinds.length === 1 && kinds[0] === 1)
    let cached: {
      id: string
      content: string
      pubkey: string
      kind: number
      tags: string[][]
      created_at: number
    }[] = []
    if (isKind1Only) {
      cached = getCachedNotes(hexPubkey, limit, until).map((e) => ({
        content: e.content,
        created_at: e.created_at,
        id: e.event_id,
        kind: e.kind,
        pubkey: e.pubkey,
        tags: e.tags
      }))
    }

    await this.connectForPublish()
    if (!this.ndk) {
      return cached
    }

    const kindList = kinds.length > 0 ? kinds : [1]
    const filter: NDKFilter = {
      authors: [hexPubkey],
      kinds: kindList as NDKKind[],
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

    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter,
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
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

    if (!isKind1Only) {
      return fresh
    }

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
    limit = NOSTR_NOTES_FETCH_DEFAULT_LIMIT,
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
    const { pubkeys: following } = await this.fetchKind3FollowingPubkeys(npub)
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
    const filter: NDKFilter = {
      authors,
      kinds: kindList as NDKKind[],
      limit
    }
    if (until) {
      filter.until = until
    }

    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter,
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
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
        if (settled) {
          return
        }
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
    filter: NDKFilter,
    timeoutMs: number
  ): Promise<Set<NDKEvent>> {
    return new Promise((resolve) => {
      let settled = false
      const collected = new Set<NDKEvent>()
      const sub = ndk.subscribe(filter, { closeOnEose: false })

      const finish = () => {
        if (settled) {
          return
        }
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
      setTimeout(() => finish(), timeoutMs)
    })
  }

  static readonly INDEXING_RELAYS = [
    'wss://indexer.coracle.social',
    'wss://relay.nos.social',
    'wss://relay.nostr.band',
    'wss://relay.primal.net',
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://relay.snort.social',
    'wss://indexer.nostrarchives.com'
  ]

  async fetchEvent(eventIdHex: string): Promise<{
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
    if (!this.ndk) {
      return null
    }

    const filter = { ids: [eventIdHex], limit: 1 }
    const poolEvent = await NostrAPI.fetchWithTimeout(
      this.ndk,
      filter,
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )
    if (!poolEvent) {
      return null
    }

    const formatted = NostrAPI.formatNdkEvent(poolEvent)
    cacheEvents([{ id: poolEvent.id, ...formatted }], this.ownPubkeys)
    return formatted
  }

  async fetchEventBatch(hexIds: string[]): Promise<
    Map<
      string,
      {
        id: string
        content: string
        pubkey: string
        kind: number
        tags: string[][]
        created_at: number
      }
    >
  > {
    const validIds = hexIds.filter((id) => /^[0-9a-f]{64}$/i.test(id))
    if (validIds.length === 0) {
      return new Map()
    }

    await this.connectForPublish()
    if (!this.ndk) {
      return new Map()
    }

    const filter: NDKFilter = { ids: validIds, limit: validIds.length }
    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter,
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )

    const result = new Map<
      string,
      {
        id: string
        content: string
        pubkey: string
        kind: number
        tags: string[][]
        created_at: number
      }
    >()
    for (const event of events) {
      if (!event.id) {
        continue
      }
      result.set(event.id, { id: event.id, ...NostrAPI.formatNdkEvent(event) })
    }
    return result
  }

  /**
   * Fetches the full signed event by id from this instance's relay pool.
   * Unlike fetchEvent, returns the raw event (sig included) so callers can
   * run NIP-59 unwrap / signature verification on it. Never cached — used by
   * diagnostics where retrieval from the relay is exactly what's proven.
   */ async fetchRawEventById(eventIdHex: string): Promise<Event | null> {
    await this.connectForPublish()
    if (!this.ndk) {
      return null
    }

    const filter = { ids: [eventIdHex], limit: 1 }
    const poolEvent = await NostrAPI.fetchWithTimeout(this.ndk, filter, 15000)
    if (!poolEvent) {
      return null
    }
    return (await poolEvent.toNostrEvent()) as Event
  }

  /**
   * Fetches a pubkey's DM inbox relays: newest kind 10050 (NIP-17) wins,
   * falling back to its kind 10002 (NIP-65) relay list. Empty when the
   * pubkey never published either — callers should fall back to defaults.
   */
  async fetchInboxRelaysForNpub(npub: string): Promise<string[]> {
    const hex = getPubKeyHexFromNpub(npub)
    if (!hex) {
      return []
    }
    await this.connect()
    if (!this.ndk) {
      return []
    }

    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      { authors: [hex], kinds: [10002, 10050], limit: 10 },
      12_000
    )
    return extractInboxRelayUrls([...events])
  }

  /**
   * Announces this identity's DM inbox relays (kind 10050, NIP-17) so
   * senders can route gift wraps where we actually read them.
   */
  async publishDmInboxRelayList(
    nsec: string,
    relayUrls: string[]
  ): Promise<void> {
    const secretKey = getSecretFromNsec(nsec)
    if (!secretKey || relayUrls.length === 0) {
      return
    }
    const signed = finalizeEvent(
      {
        content: '',
        created_at: Math.floor(Date.now() / 1000),
        kind: 10050,
        tags: relayUrls.map((url) => ['relay', url])
      },
      secretKey
    )
    const tempNdk = new NDK({
      autoConnectUserRelays: false,
      enableOutboxModel: false
    })
    await this.publishEvent(new NDKEvent(tempNdk, signed))
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
    if (relayUrls.length === 0) {
      return null
    }

    const tempNdk = createMobileNdk(relayUrls)
    try {
      await tempNdk.connect(NOSTR_TEMP_NDK_CONNECT_TIMEOUT_MS)

      const filter = { ids: [eventIdHex], limit: 1 }
      const event = await NostrAPI.fetchWithTimeout(
        tempNdk,
        filter,
        NOSTR_DEFAULT_FETCH_TIMEOUT_MS
      )
      if (!event) {
        return null
      }

      const formatted = NostrAPI.formatNdkEvent(event)
      cacheEvents([{ id: event.id, ...formatted }], ownPubkeys)
      return formatted
    } finally {
      disconnectNdkPool(tempNdk)
    }
  }

  private static ndkEventToStorableRecord(event: NDKEvent) {
    return {
      content: event.content,
      created_at: event.created_at ?? 0,
      id: event.id,
      kind: event.kind ?? 0,
      pubkey: event.pubkey,
      sig: event.sig,
      tags: event.tags.map((tag) =>
        tag.filter((v): v is string => typeof v === 'string')
      )
    }
  }

  /** Pretty-printed JSON for a single event by id (e.g. kind 9735 zap receipt). */
  static async fetchEventJsonFromRelays(
    eventIdHex: string,
    relayUrls: string[]
  ): Promise<string | null> {
    if (relayUrls.length === 0) {
      return null
    }

    const tempNdk = createMobileNdk(relayUrls)
    try {
      await tempNdk.connect(NOSTR_TEMP_NDK_CONNECT_TIMEOUT_MS)

      const filter = { ids: [eventIdHex], limit: 1 }
      const event = await NostrAPI.fetchWithTimeout(
        tempNdk,
        filter,
        NOSTR_DEFAULT_FETCH_TIMEOUT_MS
      )
      if (!event) {
        return null
      }
      return JSON.stringify(NostrAPI.ndkEventToStorableRecord(event), null, 2)
    } finally {
      disconnectNdkPool(tempNdk)
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
      setTimeout(() => this.processQueue(), NOSTR_PROCESSING_INTERVAL_MS)
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
      kinds: [NDKKind.GiftWrap],
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
          if (this.processedRawEventIds.size >= NOSTR_MAX_PROCESSED_RAW_IDS) {
            const entries = Array.from(this.processedRawEventIds)
            for (const id of entries.slice(0, Math.floor(entries.length / 2))) {
              this.processedRawEventIds.delete(id)
            }
          }
          this.processedRawEventIds.add(rawId)
        }

        if (!this.processedMessageIds.has(unwrappedEvent.id)) {
          if (this.eventQueue.length >= NOSTR_MAX_QUEUE_SIZE) {
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
      } catch (error) {
        // Malformed wrapped events must not crash the subscription, but a
        // systematic failure (e.g. a missing table) must be visible in logs.
        // eslint-disable-next-line no-console
        console.warn('[nostr] kind1059 event processing failed:', error)
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
        setTimeout(resolve, NOSTR_FLUSH_QUEUE_DELAY_MS)
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
    // NDK relay connections are kept alive via the registry for reuse.
    // startSync/stopSync cycles reuse the same NDK instance, so the Android
    // pthread OOM that previously required explicit relay.disconnect() here
    // is prevented structurally by the singleton registry instead.
  }

  disconnect(): void {
    for (const sub of this.activeSubscriptions) {
      try {
        sub.stop()
      } catch {
        // subscription may already be stopped
      }
    }
    this.activeSubscriptions.clear()
    this.ndk = null
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
    const wrap = nip17.wrapEvent(
      secretNostrKey,
      { publicKey: recipientPubKeyHex },
      content
    )
    const tempNdk = new NDK({
      autoConnectUserRelays: false,
      enableOutboxModel: false
    })
    const event = new NDKEvent(tempNdk, wrap)
    return event
  }

  /**
   * Creates a signed legacy NIP-04 DM (kind 4). Encryption and signature are
   * done inline, so publishEvent needs no signer. Prefer NIP-17
   * (createKind1059) for new conversations — kind 4 leaks metadata.
   */
  async createKind4(
    nsec: string,
    recipientNpub: string,
    content: string
  ): Promise<NDKEvent> {
    const secretNostrKey = getSecretFromNsec(nsec)
    const recipientPubKeyHex = getPubKeyHexFromNpub(recipientNpub)
    if (!secretNostrKey || !recipientPubKeyHex) {
      throw new Error('Invalid nsec or recipient npub')
    }

    const encrypted = await nip04Encrypt(
      secretNostrKey,
      recipientPubKeyHex,
      content
    )
    const signed = finalizeEvent(
      {
        content: encrypted,
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', recipientPubKeyHex]]
      },
      secretNostrKey
    )
    const tempNdk = new NDK({
      autoConnectUserRelays: false,
      enableOutboxModel: false
    })
    return new NDKEvent(tempNdk, signed)
  }

  /**
   * Subscribes to legacy NIP-04 DMs involving the given identity — both
   * addressed to it and authored by it (other-device sends). Decrypts each
   * event before invoking the callback.
   */
  async subscribeToKind4(
    recipientNsec: string,
    recipientNpub: string,
    onMessage: (message: {
      content: string
      createdAt: number
      direction: 'in' | 'out'
      id: string
      peerPubkey: string
    }) => void,
    since?: number
  ): Promise<void> {
    await this.connect()
    if (!this.ndk) {
      throw new Error('Failed to connect to relays')
    }

    const secretNostrKey = getSecretFromNsec(recipientNsec)
    const ownPubKeyHex = getPubKeyHexFromNpub(recipientNpub)
    if (!secretNostrKey || !ownPubKeyHex) {
      return
    }

    const filters: NDKFilter[] = [
      { '#p': [ownPubKeyHex], kinds: [4], ...(since && { since }) },
      { authors: [ownPubKeyHex], kinds: [4], ...(since && { since }) }
    ]

    let subscription: NDKSubscription | undefined
    try {
      subscription = this.ndk?.subscribe(filters, {
        closeOnEose: false
      }) as NDKSubscription | undefined
    } catch {
      return
    }
    if (subscription) {
      this.activeSubscriptions.add(subscription)
    }

    subscription?.on('event', async (event) => {
      try {
        const isOwn = event.pubkey === ownPubKeyHex
        const peerTag = event.tags.find((t) => t[0] === 'p')?.[1]
        const peerPubkey = isOwn ? (peerTag ?? '') : event.pubkey
        if (!peerPubkey || !/^[0-9a-f]{64}$/.test(peerPubkey)) {
          return
        }
        const plaintext = await nip04Decrypt(
          secretNostrKey,
          peerPubkey,
          event.content
        )
        onMessage({
          content: plaintext,
          createdAt: event.created_at ?? 0,
          direction: isOwn ? 'out' : 'in',
          id: event.id,
          peerPubkey
        })
      } catch (error) {
        // Undecryptable or malformed kind-4 events are ignored by design,
        // but log so real failures are diagnosable.
        // eslint-disable-next-line no-console
        console.warn('[nostr] kind4 event processing failed:', error)
      }
    })
  }

  // 20 second timeout per relay for publish operations
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
  ): Promise<NostrSignedKind1Event> {
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

  async fetchPollResponses(
    pollEventIdHex: string
  ): Promise<NostrPollResponse[]> {
    await this.connectForPublish()
    if (!this.ndk) {
      return []
    }

    const filter: NDKFilter = {
      '#e': [pollEventIdHex],
      kinds: [NOSTR_POLL_RESPONSE_KIND as NDKKind],
      limit: 500
    }
    const events = await NostrAPI.fetchManyWithTimeout(
      this.ndk,
      filter,
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )

    return [...events].map((event) => ({
      created_at: event.created_at ?? 0,
      id: event.id,
      optionIds: extractResponseOptionIds(
        event.tags.map((tag) =>
          tag.filter((value): value is string => typeof value === 'string')
        )
      ),
      pubkey: event.pubkey
    }))
  }

  async publishPollResponse(
    nsec: string,
    pollEventIdHex: string,
    optionIds: string[],
    pollRelays: string[] = []
  ): Promise<string> {
    const secretKey = getSecretFromNsec(nsec)
    if (!secretKey) {
      throw new Error('Invalid nsec')
    }

    const publishRelays = Array.from(
      new Set([...this.relays, ...pollRelays].filter(Boolean))
    )
    const signer = new NDKPrivateKeySigner(secretKey)
    const tempNdk = createMobileNdk(
      publishRelays.length > 0 ? publishRelays : this.relays
    )

    try {
      await tempNdk.connect(NOSTR_NDK_CONNECT_TIMEOUT_MS)
      tempNdk.signer = signer

      const event = new NDKEvent(tempNdk, {
        content: '',
        kind: NOSTR_POLL_RESPONSE_KIND,
        tags: [
          ['e', pollEventIdHex],
          ...optionIds.map((optionId) => ['response', optionId])
        ]
      })

      await event.sign(signer)

      const allRelayUrls = Array.from(tempNdk.pool?.relays.keys() ?? [])
      if (allRelayUrls.length === 0) {
        throw new Error('No relays in pool')
      }

      const publishPromises = allRelayUrls.map(async (url) => {
        const relay = tempNdk.pool?.relays.get(url)
        if (!relay) {
          return { error: 'Relay not found', success: false as const, url }
        }

        try {
          const timeoutPromise = new Promise<never>((_resolve, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Publish timeout after ${NOSTR_RELAY_PUBLISH_RACE_TIMEOUT_MS}ms`
                  )
                ),
              NOSTR_RELAY_PUBLISH_RACE_TIMEOUT_MS
            )
          })
          await Promise.race([relay.publish(event), timeoutPromise])
          return { success: true as const, url }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown publish error'
          return { error: message, success: false as const, url }
        }
      })

      const results = await Promise.all(publishPromises)
      const succeeded = results.filter((result) => result.success)
      if (succeeded.length === 0) {
        const errors = results
          .filter((result) => !result.success)
          .map((result) => `${result.url}: ${result.error}`)
          .join('; ')
        throw new Error(`Failed to publish to any relay: ${errors}`)
      }

      return event.id
    } finally {
      disconnectNdkPool(tempNdk)
    }
  }

  /**
   * Waits until at least one pool relay is connected (deadline-bounded).
   * NDKRelay.publish rejects queued publishes after ~2.5s, so publishing to
   * sockets still mid-handshake fails on slow mobile TLS even though they
   * would have connected a moment later. Once one relay is up, a short grace
   * period lets more join for redundancy.
   */
  private async waitForConnectedRelays(
    deadlineMs = 8_000,
    graceMs = 750
  ): Promise<
    { publish: (event: NDKEvent) => Promise<unknown>; url: string }[]
  > {
    const pool = this.ndk?.pool
    if (!pool) {
      return []
    }
    const deadline = Date.now() + deadlineMs
    let connected = pool.connectedRelays()
    while (connected.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => {
        setTimeout(resolve, 250)
      })
      connected = pool.connectedRelays()
    }
    if (connected.length > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, graceMs)
      })
      connected = pool.connectedRelays()
    }
    return connected
  }

  /** Currently connected relay urls (diagnostics/observability). */
  getConnectedRelayUrls(): string[] {
    return this.ndk?.pool?.connectedRelays().map((relay) => relay.url) ?? []
  }

  /**
   * Liveness probe: opens a short subscription for an impossible filter and
   * reports whether any relay answered (EOSE) before the deadline. Sockets
   * can rot silently — "connected" in the pool does not prove liveness.
   */
  async probeLiveness(timeoutMs = 8_000): Promise<boolean> {
    await this.connect()
    if (!this.ndk) {
      return false
    }
    return new Promise((resolve) => {
      let settled = false
      function finish(value: boolean) {
        if (settled) {
          return
        }
        settled = true
        resolve(value)
      }
      const sub = this.ndk!.subscribe(
        { authors: ['0'.repeat(64)], kinds: [0], limit: 1 } as never,
        { closeOnEose: false }
      )
      const timer = setTimeout(() => {
        sub.stop()
        finish(false)
      }, timeoutMs)
      sub.on('eose', () => {
        clearTimeout(timer)
        sub.stop()
        finish(true)
      })
    })
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

    const connectedRelays = await this.waitForConnectedRelays()
    if (connectedRelays.length === 0) {
      const total = this.ndk.pool.relays.size
      throw new Error(
        `No relay connections established (0/${total}) — check network or VPN`
      )
    }

    const publishPromises = connectedRelays.map(async (relay) => {
      try {
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  `Publish timeout after ${NOSTR_RELAY_PUBLISH_RACE_TIMEOUT_MS}ms`
                )
              ),
            NOSTR_RELAY_PUBLISH_RACE_TIMEOUT_MS
          )
        })
        await Promise.race([relay.publish(event), timeoutPromise])
        return { success: true as const, url: relay.url }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        return { error: errorMsg, success: false as const, url: relay.url }
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
