import { Buffer } from 'buffer'

import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import type { NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk'
import NetInfo from '@react-native-community/netinfo'
import { type Event, nip17, nip19, nip44, verifyEvent } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import {
  decrypt as nip04Decrypt,
  encrypt as nip04Encrypt
} from 'nostr-tools/nip04'
import { finalizeEvent, getEventHash } from 'nostr-tools/pure'

import {
  fetchProfileResult,
  fetchProfilesCoalesced,
  queueProfileFetches
} from '@/api/nostrProfileFetcher'
import {
  NOSTR_DEFAULT_FETCH_TIMEOUT_MS,
  NOSTR_ENGAGEMENT_FETCH_LIMIT,
  NOSTR_DELETION_FETCH_LIMIT,
  NOSTR_EVENT_ID_RE,
  NOSTR_FEED_FOLLOWING_MAX_AUTHORS,
  NOSTR_FIRST_RELAY_CONNECT_TIMEOUT_MS,
  NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC,
  NOSTR_HEX_PUBKEY_RE,
  NOSTR_MAX_PROCESSED_RAW_IDS,
  NOSTR_MAX_FAILED_WRAP_IDS,
  NOSTR_NDK_CONNECT_TIMEOUT_MS,
  NOSTR_NOTES_FETCH_DEFAULT_LIMIT,
  NOSTR_PROFILE_CACHE_TTL_SECS,
  NOSTR_PUBKEY_HEX_LENGTH,
  NOSTR_PUBLISH_RETRY_DEADLINE_MS,
  NOSTR_PUBLISH_TIMEOUT_MS,
  NOSTR_QUEUE_BATCH_SIZE,
  NOSTR_SECRET_KEY_BYTE_LENGTH,
  NOSTR_RELAY_LIST_FETCH_TIMEOUT_MS,
  NOSTR_RELAY_POLL_INTERVAL_MS,
  NOSTR_RELAY_PROBE_COUNT,
  NOSTR_RELAY_PUBLISH_RACE_TIMEOUT_MS,
  NOSTR_RELAY_REACHABILITY_TEST_MS,
  NOSTR_TEMP_NDK_CONNECT_TIMEOUT_MS,
  NOSTR_UI_FLUSH_INTERVAL_MS
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import {
  cacheEvents,
  deleteCachedEventsByAuthor,
  getCachedEvent,
  getCachedEvents,
  getCachedNotes,
  getCachedNotesByAuthors,
  getCachedProfile,
  getNewestCachedTimestamp
} from '@/db/nostrCache'
import { isNostrEventProcessed } from '@/db/nostrProcessedEvents'
import { getNostrFollowCache, setNostrFollowCache } from '@/storage/mmkv'
import type {
  NostrChatEventRef,
  NostrChatGiftWrap,
  NostrFeedNoteLike,
  NostrFetchResult,
  NostrFollowList,
  NostrKeys,
  NostrKind0Profile,
  NostrKind4ChatEvent,
  NostrMessage,
  NostrNotesQuery,
  NostrPollResponse,
  NostrEngagementEvent,
  NostrRelayConnectionInfo,
  NostrSignedKind1Event,
  NostrSubscriptionWindow,
  NostrUnwrappedKind1059Event
} from '@/types/models/Nostr'
import { randomKey } from '@/utils/crypto'
import {
  NostrNoRelaysError,
  NostrPublishError,
  NostrRelayTimeoutError
} from '@/utils/errors'
import {
  extractInboxRelayUrls,
  getPubKeyHexFromNpub,
  getSecretFromNsec
} from '@/utils/nostr'
import {
  NOSTR_ENGAGEMENT_KINDS,
  NOSTR_LIKE_CONTENT,
  buildReactionTags,
  buildRepost,
  dropDeletedEngagement,
  type EngagementTarget,
  toEngagementEvent
} from '@/utils/nostrEngagement'
import { getNostrErrorCode } from '@/utils/nostrErrorMessage'
import {
  getNostrTagValue,
  isNostrTags,
  isSignedNdkEvent,
  parseNostrEvent,
  parseNostrRumor
} from '@/utils/nostrEvent'
import {
  cachedEventToNote,
  getDeletedEventIds,
  getFollowedPubkeysFromTags,
  isNostrRelayUnavailableError,
  mergeNotesNewestFirst
} from '@/utils/nostrFeed'
import { extractResponseOptionIds } from '@/utils/nostrPoll'
import { isRecord } from '@/utils/object'

import {
  createEphemeralNdk,
  createMobileNdk,
  disconnectNdkPool,
  getOrCreateNdk,
  ndkRegistry
} from './ndkRegistry'
import {
  connectToFirstRelay,
  markRelayClosed,
  markRelayEose,
  normalizeRelayUrl
} from './nostrRelayHealth'

// Re-exported for existing callers (registry now lives in ./ndkRegistry).
export { clearNdkRegistry } from './ndkRegistry'

function buildRelayConnectionInfo(
  allUrls: string[],
  connectedUrls: string[]
): NostrRelayConnectionInfo {
  const probeUrls = allUrls.slice(0, NOSTR_RELAY_PROBE_COUNT)
  const connectedNormalized = new Set(connectedUrls.map(normalizeRelayUrl))
  return {
    relayDetails: probeUrls.map((url) => ({
      connected: connectedNormalized.has(normalizeRelayUrl(url)),
      url
    })),
    status: 'connected'
  }
}

/**
 * Nudges the shared NDK for this relay set to reconnect dropped relays
 * without tearing it down, so live subscriptions on it keep working.
 */
export async function reconnectNdkForRelays(
  relayUrls: string[]
): Promise<void> {
  await connectToFirstRelay(
    getOrCreateNdk(relayUrls),
    NOSTR_NDK_CONNECT_TIMEOUT_MS
  )
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
  }

  // Probe with a throw-away NDK: resetting the shared instance would kill
  // the live subscriptions (account sync, chat) that run on it.
  const probeUrls = relayUrls.slice(0, NOSTR_RELAY_PROBE_COUNT)
  const probeNdk = createEphemeralNdk(probeUrls)
  const connected = await connectToFirstRelay(
    probeNdk,
    NOSTR_RELAY_REACHABILITY_TEST_MS
  )
    .then(() => probeNdk.pool.connectedRelays().map((r) => r.url))
    .catch(() => [])
  disconnectNdkPool(probeNdk)

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

// Rumors are unsigned, so the id is the only integrity check on them: it must
// be the NIP-01 hash of the content, or dedupe by id could be spoofed.
function hasValidRumorId(rumor: unknown): boolean {
  if (!isRecord(rumor)) {
    return false
  }
  const { content, created_at, id, kind, pubkey, tags } = rumor
  if (
    typeof content !== 'string' ||
    typeof pubkey !== 'string' ||
    typeof created_at !== 'number' ||
    typeof kind !== 'number' ||
    !isNostrTags(tags)
  ) {
    return false
  }
  return getEventHash({ content, created_at, kind, pubkey, tags }) === id
}

// NIP-17 unwrap with mandatory sender-authenticity checks. nostr-tools'
// nip59.unwrapEvent only decrypts the two NIP-44 layers and returns the
// rumor: it never verifies the seal's signature nor that the seal and rumor
// pubkeys match, so anyone able to address a gift wrap to a victim (e.g. a
// relay, which learns device npubs from the sync filters) could forge the
// rumor author and impersonate a trusted device. Both checks are MUSTs in
// NIP-17, so events failing them are rejected here.
function unwrapNip59EventOrNull(
  rawEvent: Pick<Event, 'content' | 'pubkey'>,
  secretKey: Uint8Array
): NostrUnwrappedKind1059Event | null {
  try {
    const sealJson = nip44.v2.decrypt(
      rawEvent.content,
      nip44.getConversationKey(secretKey, rawEvent.pubkey)
    )
    const seal = parseNostrEvent(JSON.parse(sealJson))
    if (!seal || seal.kind !== nostrKinds.Seal || !verifyEvent(seal)) {
      return null
    }

    const rumorJson = nip44.v2.decrypt(
      seal.content,
      nip44.getConversationKey(secretKey, seal.pubkey)
    )
    const rumorValue: unknown = JSON.parse(rumorJson)
    const rumor = parseNostrRumor(rumorValue)
    if (
      !rumor ||
      rumor.pubkey !== seal.pubkey ||
      !hasValidRumorId(rumorValue)
    ) {
      return null
    }

    return rumor
  } catch {
    return null
  }
}

// Exported for unit tests
export { unwrapNip59EventOrNull }

// Wraps that failed to decrypt or verify, shared across instances so a
// resubscribe does not decrypt them again.
const failedGiftWrapIds = new Set<string>()

function rememberBounded(ids: Set<string>, id: string, max: number): void {
  ids.add(id)
  if (ids.size <= max) {
    return
  }
  const [oldest] = ids
  ids.delete(oldest)
}

type NostrKind1059Options = {
  /** Processed-events scope checked before decrypting a gift wrap. */
  processedScope?: string
}

export class NostrAPI {
  private ndk: NDK | null = null
  private activeSubscriptions = new Set<NDKSubscription>()
  private kind1059Subscription: NDKSubscription | null = null
  private processedMessageIds = new Set<string>()
  private processedRawEventIds = new Set<string>()
  private eventQueue: NostrMessage[] = []
  private inFlightCount = 0
  private queueTimer: ReturnType<typeof setTimeout> | null = null
  private queueDrain: Promise<void> | null = null
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

  /**
   * Resolves once at least one relay is connected and throws
   * NostrNoRelaysError when none connects in time. NDK routes subscriptions
   * to the remaining relays as they come online.
   */
  async connect(
    timeoutMs = NOSTR_FIRST_RELAY_CONNECT_TIMEOUT_MS
  ): Promise<true> {
    if (this.relays.length === 0) {
      throw new NostrNoRelaysError('No relays configured')
    }
    // Always resolve from the registry so all_failed resets don't leave this
    // instance pinned to an evicted/disconnected NDK.
    this.ndk = getOrCreateNdk(this.relays)
    await connectToFirstRelay(this.ndk, timeoutMs)
    return true
  }

  async connectForPublish(timeoutMs = NOSTR_PUBLISH_TIMEOUT_MS): Promise<void> {
    await this.connect(timeoutMs)
  }

  /**
   * Kind 0 (metadata) for a 64-char hex pubkey through the shared profile
   * batcher. The result says whether it came from relays or the cache.
   */
  fetchKind0ByPubkeyHex(
    hexPubkey: string
  ): Promise<NostrFetchResult<NostrKind0Profile | null>> {
    return fetchProfileResult(hexPubkey, this.relays)
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
    const { data } = await this.fetchKind0ByPubkeyHex(hexPubkey)
    return data
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
        kinds: [nostrKinds.Date],
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
            kind: event.kind ?? nostrKinds.Date,
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

    const now = Math.floor(Date.now() / MS_PER_SECOND)
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
      kinds: [nostrKinds.BookmarkList],
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

    const [latest] = [...events].toSorted(
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
      kind: nostrKinds.BookmarkList,
      tags
    })

    await event.sign(signer)
    await this.publishEvent(event)
  }

  /**
   * Latest kind 3 (NIP-02 contact list) for this npub; followed pubkeys in
   * tag order (64-char hex, lowercase), excluding duplicates and self. When
   * relays fail, the last cached list is returned with source 'cache' so
   * callers never mistake an outage for "follows nobody".
   */
  async fetchKind3FollowingPubkeys(
    npub: string
  ): Promise<NostrFetchResult<NostrFollowList>> {
    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) {
      return { data: this.emptyFollowList(), source: 'relay' }
    }

    try {
      const data = await this.fetchKind3FromRelays(npub, hexPubkey)
      return { data, source: 'relay' }
    } catch (error) {
      return {
        data: {
          ...this.emptyFollowList(),
          pubkeys: getNostrFollowCache(npub) ?? []
        },
        error: getNostrErrorCode(error),
        source: 'cache'
      }
    }
  }

  private emptyFollowList(): NostrFollowList {
    return {
      connectedRelayCount: 0,
      kind3Found: false,
      pubkeys: [],
      relaysQueried: this.relays
    }
  }

  private async fetchKind3FromRelays(
    npub: string,
    hexPubkey: string
  ): Promise<NostrFollowList> {
    await this.connect()
    const ndk = this.requireNdk()
    const connectedRelayCount = ndk.pool.connectedRelays().length

    const events = await NostrAPI.fetchManyWithTimeout(
      ndk,
      { authors: [hexPubkey], kinds: [nostrKinds.Contacts], limit: 1 },
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )
    const [latest] = [...events].toSorted(
      (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
    )
    if (!latest) {
      return { ...this.emptyFollowList(), connectedRelayCount }
    }

    const pubkeys = getFollowedPubkeysFromTags(latest.tags, hexPubkey)
    setNostrFollowCache(npub, pubkeys)
    return {
      connectedRelayCount,
      kind3Found: true,
      pubkeys,
      relaysQueried: this.relays
    }
  }

  private requireNdk(): NDK {
    if (!this.ndk) {
      throw new NostrNoRelaysError('Not connected to relays')
    }
    return this.ndk
  }

  /**
   * Own notes, newest first. Kind 1 merges with the SQLite cache and drops
   * notes the author deleted (NIP-09). On relay failure the cached notes come
   * back with source 'cache' and the error code.
   */
  async fetchNotes(
    npub: string,
    {
      kinds = [nostrKinds.ShortTextNote],
      limit = NOSTR_NOTES_FETCH_DEFAULT_LIMIT,
      since,
      until
    }: NostrNotesQuery = {}
  ): Promise<NostrFetchResult<NostrFeedNoteLike[]>> {
    const hexPubkey = getPubKeyHexFromNpub(npub)
    if (!hexPubkey) {
      return { data: [], source: 'relay' }
    }

    const kindList = kinds.length > 0 ? kinds : [nostrKinds.ShortTextNote]
    const isKind1Only =
      kindList.length === 1 && kindList[0] === nostrKinds.ShortTextNote
    const cached =
      isKind1Only && since === undefined
        ? getCachedNotes(hexPubkey, limit, until).map(cachedEventToNote)
        : []

    try {
      const fresh = await this.fetchAuthorNotesFromRelays(hexPubkey, {
        isKind1Only,
        kinds: kindList,
        limit,
        since,
        until
      })
      return {
        data: mergeNotesNewestFirst(fresh.notes, cached, limit).filter(
          (note) => !fresh.deletedIds.has(note.id)
        ),
        source: 'relay'
      }
    } catch (error) {
      return { data: cached, error: getNostrErrorCode(error), source: 'cache' }
    }
  }

  private async fetchAuthorNotesFromRelays(
    hexPubkey: string,
    {
      isKind1Only,
      kinds,
      limit,
      since,
      until
    }: NostrNotesQuery & {
      isKind1Only: boolean
      kinds: number[]
      limit: number
    }
  ): Promise<{ deletedIds: Set<string>; notes: NostrFeedNoteLike[] }> {
    await this.connectForPublish()
    const ndk = this.requireNdk()

    const filter: NDKFilter = { authors: [hexPubkey], kinds, limit }
    const newestCached = isKind1Only
      ? getNewestCachedTimestamp(nostrKinds.ShortTextNote, hexPubkey)
      : null
    if (until) {
      filter.until = until
    } else if (since !== undefined) {
      filter.since = since
    } else if (newestCached) {
      filter.since = newestCached + 1
    }

    const isHeadPage = until === undefined && since === undefined
    const [notesResult, deletionsResult] = await Promise.allSettled([
      NostrAPI.fetchManyWithTimeout(
        ndk,
        filter,
        NOSTR_DEFAULT_FETCH_TIMEOUT_MS
      ),
      isHeadPage
        ? NostrAPI.fetchManyWithTimeout(
            ndk,
            {
              authors: [hexPubkey],
              kinds: [nostrKinds.EventDeletion],
              limit: NOSTR_DELETION_FETCH_LIMIT
            },
            NOSTR_DEFAULT_FETCH_TIMEOUT_MS
          )
        : Promise.resolve(new Set<NDKEvent>())
    ])
    if (notesResult.status === 'rejected') {
      throw notesResult.reason
    }

    const deletedIds =
      deletionsResult.status === 'fulfilled'
        ? getDeletedEventIds([...deletionsResult.value], hexPubkey)
        : new Set<string>()
    if (deletedIds.size > 0) {
      deleteCachedEventsByAuthor([...deletedIds], hexPubkey)
    }

    const notes = [...notesResult.value]
      .map((e) => ({ id: e.id, ...NostrAPI.formatNdkEvent(e) }))
      .filter((note) => !deletedIds.has(note.id))
      .toSorted((a, b) => b.created_at - a.created_at)
    cacheEvents(notes, this.ownPubkeys)
    return { deletedIds, notes }
  }

  /**
   * Notes from the given authors (usually the kind 3 follow list). `kinds`
   * defaults to short text notes; pass reposts (6, 16) etc. as needed.
   * Authors are capped for relay compatibility. Falls back to cached notes
   * from the same authors when relays fail.
   */
  async fetchFollowingTimelineNotes(
    authors: string[],
    {
      kinds = [nostrKinds.ShortTextNote],
      limit = NOSTR_NOTES_FETCH_DEFAULT_LIMIT,
      since,
      until
    }: NostrNotesQuery = {}
  ): Promise<NostrFetchResult<NostrFeedNoteLike[]>> {
    const cappedAuthors = authors.slice(0, NOSTR_FEED_FOLLOWING_MAX_AUTHORS)
    if (cappedAuthors.length === 0) {
      return { data: [], source: 'relay' }
    }
    const kindList = kinds.length > 0 ? kinds : [nostrKinds.ShortTextNote]

    try {
      await this.connectForPublish()
      const filter: NDKFilter = {
        authors: cappedAuthors,
        kinds: kindList,
        limit
      }
      if (until) {
        filter.until = until
      }
      if (since !== undefined) {
        filter.since = since
      }
      const events = await NostrAPI.fetchManyWithTimeout(
        this.requireNdk(),
        filter,
        NOSTR_DEFAULT_FETCH_TIMEOUT_MS
      )
      const notes = [...events]
        .map((e) => ({ id: e.id, ...NostrAPI.formatNdkEvent(e) }))
        .toSorted((a, b) => b.created_at - a.created_at)
      cacheEvents(notes, this.ownPubkeys)
      return { data: notes, source: 'relay' }
    } catch (error) {
      const cached =
        since === undefined
          ? getCachedNotesByAuthors(cappedAuthors, kindList, limit, until)
          : []
      return {
        data: cached.map(cachedEventToNote),
        error: getNostrErrorCode(error),
        source: 'cache'
      }
    }
  }

  private static formatNdkEvent(event: NDKEvent) {
    return {
      content: event.content,
      created_at: event.created_at ?? 0,
      kind: event.kind ?? nostrKinds.ShortTextNote,
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
  /**
   * Subscribe-based single-event fetch. Resolves with the first match, or
   * null once a relay answered EOSE without it. Throws
   * NostrRelayTimeoutError when no relay answered at all, so "not found"
   * and "relays unreachable" stay distinguishable.
   */
  private static fetchWithTimeout(
    ndk: NDK,
    filter: NDKFilter,
    timeoutMs: number
  ): Promise<NDKEvent | null> {
    return NostrAPI.fetchManyWithTimeout(ndk, filter, timeoutMs, {
      stopOnFirstEvent: true
    }).then((events) => [...events][0] ?? null)
  }

  /**
   * Subscribe-based multi-event fetch. Collects events until a connected
   * relay answers EOSE. A timeout with events in hand returns what arrived;
   * a timeout with nothing and no EOSE throws NostrRelayTimeoutError.
   */
  private static fetchManyWithTimeout(
    ndk: NDK,
    filter: NDKFilter<number>,
    timeoutMs: number,
    { stopOnFirstEvent = false }: { stopOnFirstEvent?: boolean } = {}
  ): Promise<Set<NDKEvent>> {
    return new Promise((resolve, reject) => {
      const collected = new Set<NDKEvent>()
      const state = { settled: false }

      function finish(error?: Error) {
        if (state.settled) {
          return
        }
        state.settled = true
        clearTimeout(timer)
        sub.stop()
        if (error) {
          reject(error)
          return
        }
        resolve(collected)
      }

      const timer = setTimeout(() => {
        if (collected.size > 0) {
          finish()
          return
        }
        finish(
          new NostrRelayTimeoutError(`No relay answered within ${timeoutMs}ms`)
        )
      }, timeoutMs)
      const sub = ndk.subscribe(filter, { closeOnEose: false })

      sub.on('event', (event: NDKEvent) => {
        collected.add(event)
        if (stopOnFirstEvent) {
          finish()
        }
      })
      sub.on('closed', (relay, reason) => {
        markRelayClosed(relay.url, reason)
      })
      sub.on('eose', () => {
        if (ndk.pool.connectedRelays().length === 0) {
          return
        }
        for (const relay of ndk.pool.connectedRelays()) {
          markRelayEose(relay.url)
        }
        finish()
      })
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

  /**
   * Events by id: SQLite cache first, relays only for the missing ones.
   * On relay failure the cached subset comes back with source 'cache'.
   */
  async fetchEventBatch(
    hexIds: string[]
  ): Promise<NostrFetchResult<Map<string, NostrFeedNoteLike>>> {
    const validIds = [
      ...new Set(hexIds.filter((id) => NOSTR_EVENT_ID_RE.test(id)))
    ]
    const result = new Map(
      getCachedEvents(validIds).map((cached) => [
        cached.event_id,
        cachedEventToNote(cached)
      ])
    )
    const missing = validIds.filter((id) => !result.has(id))
    if (missing.length === 0) {
      return { data: result, source: 'relay' }
    }

    try {
      await this.connectForPublish()
      const events = await NostrAPI.fetchManyWithTimeout(
        this.requireNdk(),
        { ids: missing, limit: missing.length },
        NOSTR_DEFAULT_FETCH_TIMEOUT_MS
      )
      const fresh = [...events]
        .filter((event) => Boolean(event.id))
        .map((event) => ({ id: event.id, ...NostrAPI.formatNdkEvent(event) }))
      cacheEvents(fresh, this.ownPubkeys)
      for (const note of fresh) {
        result.set(note.id, note)
      }
      return { data: result, source: 'relay' }
    } catch (error) {
      return { data: result, error: getNostrErrorCode(error), source: 'cache' }
    }
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
    const poolEvent = await NostrAPI.fetchWithTimeout(
      this.ndk,
      filter,
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )
    if (!poolEvent) {
      return null
    }
    const rawEvent = await poolEvent.toNostrEvent()
    return isSignedNdkEvent(rawEvent) ? rawEvent : null
  }

  /**
   * Fetches a pubkey's DM inbox relays: newest kind 10050 (NIP-17) wins,
   * falling back to its kind 10002 (NIP-65) relay list. Empty when the
   * pubkey never published either or relays are unreachable — callers
   * fall back to their default relays.
   */
  async fetchInboxRelaysForNpub(npub: string): Promise<string[]> {
    const hex = getPubKeyHexFromNpub(npub)
    if (!hex) {
      return []
    }
    try {
      await this.connect()
      const events = await NostrAPI.fetchManyWithTimeout(
        this.requireNdk(),
        {
          authors: [hex],
          kinds: [nostrKinds.RelayList, nostrKinds.DirectMessageRelaysList],
          limit: 10
        },
        NOSTR_RELAY_LIST_FETCH_TIMEOUT_MS
      )
      return extractInboxRelayUrls([...events])
    } catch (error) {
      if (isNostrRelayUnavailableError(error)) {
        return []
      }
      throw error
    }
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
        created_at: Math.floor(Date.now() / MS_PER_SECOND),
        kind: nostrKinds.DirectMessageRelaysList,
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

    const tempNdk = createEphemeralNdk(relayUrls)
    try {
      await connectToFirstRelay(tempNdk, NOSTR_TEMP_NDK_CONNECT_TIMEOUT_MS)

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
      kind: event.kind ?? nostrKinds.Metadata,
      pubkey: event.pubkey,
      sig: event.sig,
      tags: event.tags.map((tag) =>
        tag.filter((v): v is string => typeof v === 'string')
      )
    }
  }

  static async generateNostrKeys(): Promise<NostrKeys> {
    const randomHex = await randomKey(NOSTR_SECRET_KEY_BYTE_LENGTH)
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

  private clearQueueTimer() {
    if (this.queueTimer) {
      clearTimeout(this.queueTimer)
      this.queueTimer = null
    }
  }

  private scheduleQueue() {
    if (this.queueTimer || this.queueDrain) {
      return
    }
    this.queueTimer = setTimeout(() => {
      this.queueTimer = null
      void this.drainQueue()
    }, NOSTR_UI_FLUSH_INTERVAL_MS)
  }

  private drainQueue(): Promise<void> {
    if (!this.queueDrain) {
      this.queueDrain = this.runQueueDrain()
    }
    return this.queueDrain
  }

  private async runQueueDrain(): Promise<void> {
    try {
      await this.processQueue()
    } finally {
      this.queueDrain = null
      if (this.eventQueue.length > 0) {
        this.scheduleQueue()
      }
    }
  }

  /**
   * Hands queued rumors to the callback in one batch. Ids are remembered only
   * once the callback resolves; on failure the wraps are forgotten so a later
   * delivery of the same events is processed again.
   */
  private async processQueue(): Promise<void> {
    const deliver = this._callback
    if (!deliver) {
      return
    }
    const batch = this.eventQueue
      .splice(0, NOSTR_QUEUE_BATCH_SIZE)
      .filter((message) => !this.processedMessageIds.has(message.id))
    if (batch.length === 0) {
      return
    }
    this.inFlightCount = batch.length
    try {
      await deliver(batch)
      for (const message of batch) {
        rememberBounded(
          this.processedMessageIds,
          message.id,
          NOSTR_MAX_PROCESSED_RAW_IDS
        )
      }
    } catch {
      for (const message of batch) {
        if (message.wrapId) {
          this.processedRawEventIds.delete(message.wrapId)
        }
      }
    } finally {
      this.inFlightCount = 0
    }
  }

  /** Events received but not yet handed to the callback. */
  getQueuedEventCount(): number {
    return this.eventQueue.length
  }

  /** Events received but not yet handed to (or resolved by) the callback. */
  getPendingEventCount(): number {
    return this.eventQueue.length + this.inFlightCount
  }

  private async enqueueGiftWrap(
    event: NDKEvent,
    recipientSecretKey: Uint8Array,
    recipientPubKeyHex: string,
    processedScope?: string
  ): Promise<void> {
    const rawEvent = await event.toNostrEvent()
    const wrapId = rawEvent.id
    const failedKey = `${recipientPubKeyHex}:${wrapId}`
    if (
      !wrapId ||
      this.processedRawEventIds.has(wrapId) ||
      failedGiftWrapIds.has(failedKey)
    ) {
      return
    }
    rememberBounded(
      this.processedRawEventIds,
      wrapId,
      NOSTR_MAX_PROCESSED_RAW_IDS
    )
    if (processedScope && isNostrEventProcessed(processedScope, wrapId)) {
      return
    }

    const unwrappedEvent = unwrapNip59EventOrNull(rawEvent, recipientSecretKey)
    if (!unwrappedEvent) {
      rememberBounded(failedGiftWrapIds, failedKey, NOSTR_MAX_FAILED_WRAP_IDS)
      return
    }
    if (this.processedMessageIds.has(unwrappedEvent.id)) {
      return
    }

    this.eventQueue.push({
      content: unwrappedEvent,
      created_at: unwrappedEvent.created_at ?? 0,
      id: unwrappedEvent.id,
      pubkey: event.pubkey,
      wrapId
    })
    this.scheduleQueue()
  }

  private async enqueueGiftWrapSafely(
    event: NDKEvent,
    recipientSecretKey: Uint8Array,
    recipientPubKeyHex: string,
    processedScope?: string
  ): Promise<void> {
    try {
      await this.enqueueGiftWrap(
        event,
        recipientSecretKey,
        recipientPubKeyHex,
        processedScope
      )
    } catch {
      // A malformed wrap must not break the subscription; forget it so a
      // later delivery is retried.
      this.processedRawEventIds.delete(event.id)
    }
  }

  private _callback?: (messages: NostrMessage[]) => void | Promise<void>

  /**
   * Live gift-wrap (kind 1059) subscription for one recipient key. Calling it
   * again on the same instance replaces the previous subscription.
   */
  async subscribeToKind1059(
    recipientNsec: string,
    recipientNpub: string,
    callback: (messages: NostrMessage[]) => void | Promise<void>,
    limit?: number,
    since?: number,
    onEOSE?: (nsec: string) => void,
    options: NostrKind1059Options = {}
  ): Promise<void> {
    await this.connect()
    const { ndk } = this
    if (!ndk) {
      throw new NostrNoRelaysError('Failed to connect to relays')
    }

    const recipientSecretNostrKey = getSecretFromNsec(recipientNsec)
    const recipientPubKeyHex = getPubKeyHexFromNpub(recipientNpub)
    if (!recipientSecretNostrKey || !recipientPubKeyHex) {
      return
    }

    this.stopKind1059Subscription()
    this.setLoading(true)
    this._callback = callback

    // NIP-59: wrap created_at is randomized up to two days into the past, so
    // the filter reaches back by that much to not miss recent wraps.
    const sinceTimestamp =
      since && since > 0
        ? since - NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC
        : undefined

    const subscription = ndk.subscribe(
      {
        '#p': [recipientPubKeyHex],
        kinds: [nostrKinds.GiftWrap],
        ...(limit && { limit }),
        ...(sinceTimestamp !== undefined && { since: sinceTimestamp })
      },
      { closeOnEose: false }
    )
    this.kind1059Subscription = subscription
    this.activeSubscriptions.add(subscription)

    subscription.on('event', (event: NDKEvent) => {
      void this.enqueueGiftWrapSafely(
        event,
        recipientSecretNostrKey,
        recipientPubKeyHex,
        options.processedScope
      )
    })

    subscription.on('eose', () => {
      onEOSE?.(recipientNsec)
      this.setLoading(false)
    })

    subscription.on('close', () => {
      this.activeSubscriptions.delete(subscription)
    })
  }

  private stopKind1059Subscription() {
    const previous = this.kind1059Subscription
    if (!previous) {
      return
    }
    previous.stop()
    this.activeSubscriptions.delete(previous)
    this.kind1059Subscription = null
  }

  async flushQueue(): Promise<void> {
    this.clearQueueTimer()
    while (this._callback && (this.eventQueue.length > 0 || this.queueDrain)) {
      await this.drainQueue()
    }
    this.clearQueueTimer()
  }

  closeAllSubscriptions() {
    for (const subscription of this.activeSubscriptions) {
      subscription.stop()
    }
    this.activeSubscriptions.clear()
    this.kind1059Subscription = null
    this.clearQueueTimer()
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
    this.kind1059Subscription = null
    this.clearQueueTimer()
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
        created_at: Math.floor(Date.now() / MS_PER_SECOND),
        kind: nostrKinds.EncryptedDirectMessage,
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
   * addressed to it and authored by it (other-device sends). Events that
   * `shouldDecrypt` rejects are skipped before decryption.
   */
  async subscribeToKind4(
    recipientNsec: string,
    recipientNpub: string,
    onMessage: (message: NostrKind4ChatEvent) => void,
    {
      shouldDecrypt,
      ...window
    }: NostrSubscriptionWindow & {
      shouldDecrypt?: (event: NostrChatEventRef) => boolean
    } = {}
  ): Promise<void> {
    const { ndk, pubkeyHex, secretKey } = await this.connectWithIdentityKeys(
      recipientNsec,
      recipientNpub
    )
    const windowFilter = NostrAPI.getSubscriptionWindowFilter(window)
    const subscription = this.openTrackedSubscription(
      ndk,
      [
        {
          '#p': [pubkeyHex],
          kinds: [nostrKinds.EncryptedDirectMessage],
          ...windowFilter
        },
        {
          authors: [pubkeyHex],
          kinds: [nostrKinds.EncryptedDirectMessage],
          ...windowFilter
        }
      ],
      window
    )

    subscription.on('event', (event: NDKEvent) => {
      const ref = { createdAt: event.created_at ?? 0, id: event.id }
      if (shouldDecrypt !== undefined && !shouldDecrypt(ref)) {
        return
      }
      const isOwn = event.pubkey === pubkeyHex
      const peerPubkey = isOwn
        ? getNostrTagValue(event.tags, 'p')
        : event.pubkey
      if (peerPubkey === undefined || !NOSTR_HEX_PUBKEY_RE.test(peerPubkey)) {
        return
      }
      try {
        const plaintext = nip04Decrypt(secretKey, peerPubkey, event.content)
        onMessage({
          content: plaintext,
          createdAt: ref.createdAt,
          direction: isOwn ? 'out' : 'in',
          id: ref.id,
          peerPubkey
        })
      } catch {
        // Undecryptable or malformed kind-4 events are ignored by design.
      }
    })
  }

  /**
   * Subscribes to NIP-17 chat gift wraps addressed to an identity.
   * `shouldUnwrap` sees only the outer wrap, so callers skip wraps they
   * already processed without paying for decryption. A wrap that fails the
   * NIP-17 checks is reported with a null rumor.
   */
  async subscribeToChatGiftWraps(
    recipientNsec: string,
    recipientNpub: string,
    {
      onWrap,
      shouldUnwrap
    }: {
      onWrap: (wrap: NostrChatGiftWrap) => void
      shouldUnwrap: (wrap: NostrChatEventRef) => boolean
    },
    window: NostrSubscriptionWindow = {}
  ): Promise<void> {
    const { ndk, pubkeyHex, secretKey } = await this.connectWithIdentityKeys(
      recipientNsec,
      recipientNpub
    )
    const subscription = this.openTrackedSubscription(
      ndk,
      [
        {
          '#p': [pubkeyHex],
          kinds: [nostrKinds.GiftWrap],
          ...NostrAPI.getSubscriptionWindowFilter(window)
        }
      ],
      window
    )

    subscription.on('event', (event: NDKEvent) => {
      const wrap = { createdAt: event.created_at ?? 0, id: event.id }
      try {
        if (wrap.id === '' || !shouldUnwrap(wrap)) {
          return
        }
        onWrap({ ...wrap, rumor: unwrapNip59EventOrNull(event, secretKey) })
      } catch {
        // A failing consumer must not tear down the relay subscription.
      }
    })
  }

  private async connectWithIdentityKeys(nsec: string, npub: string) {
    await this.connect()
    const secretKey = getSecretFromNsec(nsec)
    const pubkeyHex = getPubKeyHexFromNpub(npub)
    if (!this.ndk || !secretKey || pubkeyHex === null) {
      throw new Error('Invalid identity keys')
    }
    return { ndk: this.ndk, pubkeyHex, secretKey }
  }

  private openTrackedSubscription(
    ndk: NDK,
    filters: NDKFilter[],
    { closeOnEose = false, onEose }: NostrSubscriptionWindow
  ): NDKSubscription {
    const subscription = ndk.subscribe(filters, { closeOnEose })
    this.activeSubscriptions.add(subscription)
    subscription.on('eose', () => {
      onEose?.()
    })
    subscription.on('close', () => {
      this.activeSubscriptions.delete(subscription)
    })
    return subscription
  }

  private static getSubscriptionWindowFilter({
    limit,
    since,
    until
  }: NostrSubscriptionWindow): NDKFilter {
    return {
      ...(limit !== undefined && { limit }),
      ...(since !== undefined && { since }),
      ...(until !== undefined && { until })
    }
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
      kind: nostrKinds.EventDeletion,
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
      kind: nostrKinds.ShortTextNote,
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
      kind: event.kind ?? nostrKinds.ShortTextNote,
      pubkey: event.pubkey,
      sig: event.sig,
      tags: event.tags.map((tag) =>
        tag.filter((v): v is string => typeof v === 'string')
      )
    }
  }

  /** Signs and publishes a kind 1 note; returns the signed event as sent. */
  async publishNote(
    nsec: string,
    content: string,
    tags?: string[][]
  ): Promise<NostrFeedNoteLike> {
    const secretKey = getSecretFromNsec(nsec)
    if (!secretKey) {
      throw new Error('Invalid nsec')
    }

    const signer = new NDKPrivateKeySigner(secretKey)
    await this.connectForPublish()
    const ndk = this.requireNdk()

    ndk.signer = signer
    const event = new NDKEvent(ndk, {
      content,
      kind: nostrKinds.ShortTextNote,
      tags: tags ?? []
    })

    await event.sign(signer)
    await this.publishEvent(event)
    return { id: event.id, ...NostrAPI.formatNdkEvent(event) }
  }

  async fetchPollResponses(
    pollEventIdHex: string
  ): Promise<NostrPollResponse[]> {
    await this.connectForPublish()
    if (!this.ndk) {
      return []
    }

    const filter: NDKFilter<number> = {
      '#e': [pollEventIdHex],
      kinds: [nostrKinds.PollResponse],
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

  /**
   * Likes and reposts (NIP-25, NIP-18) of the given notes. Only deletions
   * signed by `ownPubkey` are fetched: relays drop most deleted events
   * themselves, and asking for every author's deletions would not scale to a
   * feed window.
   */
  async fetchEngagement(
    noteIds: string[],
    ownPubkey: string
  ): Promise<NostrEngagementEvent[]> {
    if (noteIds.length === 0) {
      return []
    }
    await this.connectForPublish()
    const ndk = this.requireNdk()

    const engagementEvents = await NostrAPI.fetchManyWithTimeout(
      ndk,
      {
        '#e': noteIds,
        kinds: NOSTR_ENGAGEMENT_KINDS,
        limit: NOSTR_ENGAGEMENT_FETCH_LIMIT
      },
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )
    const events = [...engagementEvents].flatMap((event) => {
      const parsed = toEngagementEvent({
        content: event.content,
        created_at: event.created_at ?? 0,
        id: event.id,
        kind: event.kind ?? nostrKinds.Reaction,
        pubkey: event.pubkey,
        tags: NostrAPI.stringTags(event.tags)
      })
      return parsed ? [parsed] : []
    })
    const ownEventIds = events
      .filter((event) => event.pubkey === ownPubkey)
      .map((event) => event.id)
    if (ownEventIds.length === 0) {
      return events
    }

    const deletionEvents = await NostrAPI.fetchManyWithTimeout(
      ndk,
      {
        '#e': ownEventIds,
        authors: [ownPubkey],
        kinds: [nostrKinds.EventDeletion]
      },
      NOSTR_DEFAULT_FETCH_TIMEOUT_MS
    )
    return dropDeletedEngagement(
      events,
      [...deletionEvents].map((event) => ({
        pubkey: event.pubkey,
        tags: NostrAPI.stringTags(event.tags)
      }))
    )
  }

  /** Signs and publishes a NIP-25 reaction (kind 7) to a note. */
  publishReaction(
    nsec: string,
    target: EngagementTarget,
    content = NOSTR_LIKE_CONTENT
  ): Promise<NostrEngagementEvent> {
    return this.publishEngagement(nsec, target, {
      content,
      kind: nostrKinds.Reaction,
      tags: buildReactionTags(target)
    })
  }

  /** Signs and publishes a NIP-18 repost (kind 6 or 16) of a note. */
  publishRepost(
    nsec: string,
    target: EngagementTarget
  ): Promise<NostrEngagementEvent> {
    return this.publishEngagement(nsec, target, {
      content: '',
      ...buildRepost(target, this.relays[0] ?? '')
    })
  }

  private async publishEngagement(
    nsec: string,
    target: EngagementTarget,
    template: { content: string; kind: number; tags: string[][] }
  ): Promise<NostrEngagementEvent> {
    const secretKey = getSecretFromNsec(nsec)
    if (!secretKey) {
      throw new Error('Invalid nsec')
    }

    const signer = new NDKPrivateKeySigner(secretKey)
    await this.connectForPublish()
    const ndk = this.requireNdk()

    ndk.signer = signer
    const event = new NDKEvent(ndk, template)
    await event.sign(signer)
    await this.publishEvent(event)
    return {
      content: event.content,
      created_at: event.created_at ?? 0,
      id: event.id,
      kind: template.kind,
      pubkey: event.pubkey,
      targetId: target.id
    }
  }

  private static stringTags(tags: unknown[][]): string[][] {
    return tags.map((tag) =>
      tag.filter((value): value is string => typeof value === 'string')
    )
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

    const publishRelays = [
      ...new Set([...this.relays, ...pollRelays].filter(Boolean))
    ]
    const signer = new NDKPrivateKeySigner(secretKey)
    const tempNdk = createMobileNdk(
      publishRelays.length > 0 ? publishRelays : this.relays
    )

    try {
      await connectToFirstRelay(tempNdk, NOSTR_NDK_CONNECT_TIMEOUT_MS)
      tempNdk.signer = signer

      const event = new NDKEvent(tempNdk, {
        content: '',
        kind: nostrKinds.PollResponse,
        tags: [
          ['e', pollEventIdHex],
          ...optionIds.map((optionId) => ['response', optionId])
        ]
      })

      await event.sign(signer)

      const allRelayUrls = [...(tempNdk.pool?.relays.keys() ?? [])]
      if (allRelayUrls.length === 0) {
        throw new NostrNoRelaysError('No relays in pool')
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
        throw new NostrPublishError(
          results.flatMap((result) =>
            result.success ? [] : [{ reason: result.error, url: result.url }]
          )
        )
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
    deadlineMs = 8000,
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
        setTimeout(resolve, NOSTR_RELAY_POLL_INTERVAL_MS)
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
  async probeLiveness(timeoutMs = 8000): Promise<boolean> {
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
        {
          authors: ['0'.repeat(NOSTR_PUBKEY_HEX_LENGTH)],
          kinds: [nostrKinds.Metadata],
          limit: 1
        },
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
      throw new NostrNoRelaysError(
        `No relay connections established (0/${total}) — check network or VPN`
      )
    }

    const publishTo = (
      relays: { publish: (event: NDKEvent) => Promise<unknown>; url: string }[]
    ) =>
      Promise.all(
        relays.map(async (relay) => {
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
            const errorMsg =
              error instanceof Error ? error.message : String(error)
            return { error: errorMsg, success: false as const, url: relay.url }
          }
        })
      )

    let results = await publishTo(connectedRelays)
    const succeeded = new Set(
      results.filter((r) => r.success).map((r) => r.url)
    )
    const intendedUrls = [...this.ndk.pool.relays.values()].map(
      (relay) => relay.url
    )
    const missed = intendedUrls.filter((url) => !succeeded.has(url))
    if (missed.length > 0) {
      const retryConnected = await this.waitForConnectedRelays(
        NOSTR_PUBLISH_RETRY_DEADLINE_MS,
        NOSTR_RELAY_POLL_INTERVAL_MS
      )
      const retryTargets = retryConnected.filter(
        (relay) => !succeeded.has(relay.url)
      )
      if (retryTargets.length > 0) {
        results = [...results, ...(await publishTo(retryTargets))]
      }
    }

    if (results.some((r) => r.success)) {
      return
    }
    throw new NostrPublishError(
      results.flatMap((r) =>
        r.success ? [] : [{ reason: r.error, url: r.url }]
      )
    )
  }
}
