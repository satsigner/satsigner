import type NDK from '@nostr-dev-kit/ndk'
import { type NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk'
import * as nostrKinds from 'nostr-tools/kinds'

import {
  createEphemeralNdk,
  disconnectNdkPool,
  getOrCreateNdk
} from '@/api/ndkRegistry'
import { connectToFirstRelay } from '@/api/nostrRelayHealth'
import {
  NOSTR_FIRST_RELAY_CONNECT_TIMEOUT_MS,
  NOSTR_HEX_PUBKEY_RE,
  NOSTR_INDEXER_RELAYS,
  NOSTR_PROFILE_BACKOFF_BASE_MS,
  NOSTR_PROFILE_BACKOFF_MAX_MS,
  NOSTR_PROFILE_BATCH_BUFFER_MS,
  NOSTR_PROFILE_BATCH_FLUSH_AT,
  NOSTR_PROFILE_BATCH_SIZE,
  NOSTR_PROFILE_CACHE_TTL_SECS,
  NOSTR_PROFILE_FETCH_EOSE_TIMEOUT_MS,
  NOSTR_TEMP_NDK_CONNECT_TIMEOUT_MS
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import {
  type CachedProfile,
  cacheProfile,
  getCachedProfile
} from '@/db/nostrCache'
import type {
  NostrErrorCode,
  NostrFetchResult,
  NostrKind0Profile
} from '@/types/models/Nostr'
import { chunk } from '@/utils/array'
import { NostrRelayTimeoutError } from '@/utils/errors'
import { getProfileFromKind0Content } from '@/utils/nostr'
import { getNostrErrorCode } from '@/utils/nostrErrorMessage'

const BACKOFF_FACTOR = 2
const PROFILE_TTL_MS = NOSTR_PROFILE_CACHE_TTL_SECS * MS_PER_SECOND

type ProfileResult = NostrFetchResult<NostrKind0Profile | null>
type ProfileBatch = Map<string, NostrKind0Profile>
type BatchCallback = (batch: ProfileBatch) => void
type ProfileWaiter = (result: ProfileResult) => void
type ProfileFetchOptions = { onBatch?: BatchCallback; relays?: string[] }

type ProfileRequest = {
  callbacks: Set<BatchCallback>
  relays: string[]
  waiters: ProfileWaiter[]
}

type ProfileBackoff = {
  attempts: number
  error: NostrErrorCode
  retryAt: number
}

type FetchedProfile = {
  createdAt: number
  eventId: string
  profile: NostrKind0Profile
}

type TierOutcome = {
  answered: boolean
  error?: NostrErrorCode
  profiles: Map<string, FetchedProfile>
}

type ChunkOutcome = {
  answered: boolean
  error?: NostrErrorCode
  found: Map<string, FetchedProfile>
}

const pending = new Map<string, ProfileRequest>()
const inFlight = new Map<string, ProfileRequest>()
const backoff = new Map<string, ProfileBackoff>()
const answeredAt = new Map<string, number>()
const flushState: { timer: ReturnType<typeof setTimeout> | null } = {
  timer: null
}

function isValidHex(hexPubkey: string): boolean {
  return NOSTR_HEX_PUBKEY_RE.test(hexPubkey)
}

function toProfile(cached: CachedProfile): NostrKind0Profile {
  return {
    banner: cached.banner,
    displayName: cached.displayName,
    lud16: cached.lud16,
    nip05: cached.nip05,
    picture: cached.picture
  }
}

function isCacheFresh(cached: CachedProfile, now = Date.now()): boolean {
  return now - cached.cached_at * MS_PER_SECOND < PROFILE_TTL_MS
}

/** What we know without touching relays: fresh cache, stale cache, or nothing. */
function getCachedResult(hexPubkey: string): ProfileResult {
  const cached = getCachedProfile(hexPubkey)
  const error = backoff.get(hexPubkey)?.error
  if (!cached) {
    return {
      data: null,
      error,
      source: answeredAt.has(hexPubkey) ? 'relay' : 'cache'
    }
  }
  if (isCacheFresh(cached)) {
    return { data: toProfile(cached), source: 'cache' }
  }
  return { data: toProfile(cached), error, source: 'stale' }
}

function isLoadThrottled(hexPubkey: string, now = Date.now()): boolean {
  const lastAnswer = answeredAt.get(hexPubkey)
  if (lastAnswer !== undefined && now - lastAnswer < PROFILE_TTL_MS) {
    return true
  }
  const retryAt = backoff.get(hexPubkey)?.retryAt ?? 0
  return retryAt > now
}

function getBackoffDelay(attempts: number): number {
  return Math.min(
    NOSTR_PROFILE_BACKOFF_BASE_MS * BACKOFF_FACTOR ** (attempts - 1),
    NOSTR_PROFILE_BACKOFF_MAX_MS
  )
}

// FETCH

/**
 * Collects kind 0 events until a connected relay sends EOSE. Throws
 * NostrRelayTimeoutError when no relay answered and nothing arrived.
 */
function fetchKind0Events(
  ndk: NDK,
  hexPubkeys: string[],
  timeoutMs: number
): Promise<Map<string, FetchedProfile>> {
  return new Promise((resolve, reject) => {
    const state = { settled: false }
    const newest = new Map<string, FetchedProfile>()
    const filter: NDKFilter = {
      authors: hexPubkeys,
      kinds: [nostrKinds.Metadata],
      limit: hexPubkeys.length
    }
    const sub = ndk.subscribe(filter, { closeOnEose: false })

    function finish(answered: boolean) {
      if (state.settled) {
        return
      }
      state.settled = true
      clearTimeout(timer)
      sub.stop()
      if (!answered && newest.size === 0) {
        reject(new NostrRelayTimeoutError('No relay answered the kind 0 REQ'))
        return
      }
      resolve(newest)
    }

    const timer = setTimeout(() => finish(false), timeoutMs)

    sub.on('event', (event: NDKEvent) => {
      if (!event.pubkey || !event.content) {
        return
      }
      const profile = getProfileFromKind0Content(event.content)
      if (!profile) {
        return
      }
      const createdAt = event.created_at ?? 0
      const existing = newest.get(event.pubkey)
      if (!existing || createdAt > existing.createdAt) {
        newest.set(event.pubkey, {
          createdAt,
          eventId: event.id ?? '',
          profile
        })
      }
    })
    sub.on('eose', () => {
      if ((ndk.pool?.connectedRelays().length ?? 0) > 0) {
        finish(true)
      }
    })
  })
}

async function fetchFromRelays(
  relays: string[],
  hexPubkeys: string[]
): Promise<Map<string, FetchedProfile>> {
  const ndk = getOrCreateNdk(relays)
  await connectToFirstRelay(ndk, NOSTR_FIRST_RELAY_CONNECT_TIMEOUT_MS)
  return fetchKind0Events(ndk, hexPubkeys, NOSTR_PROFILE_FETCH_EOSE_TIMEOUT_MS)
}

async function fetchFromIndexerRelays(
  hexPubkeys: string[]
): Promise<Map<string, FetchedProfile>> {
  const ephemeral = createEphemeralNdk(NOSTR_INDEXER_RELAYS)
  try {
    await connectToFirstRelay(ephemeral, NOSTR_TEMP_NDK_CONNECT_TIMEOUT_MS)
    return await fetchKind0Events(
      ephemeral,
      hexPubkeys,
      NOSTR_PROFILE_FETCH_EOSE_TIMEOUT_MS
    )
  } finally {
    disconnectNdkPool(ephemeral)
  }
}

async function settleTier(
  run: () => Promise<Map<string, FetchedProfile>>
): Promise<TierOutcome> {
  try {
    return { answered: true, profiles: await run() }
  } catch (error) {
    return {
      answered: false,
      error: getNostrErrorCode(error),
      profiles: new Map()
    }
  }
}

function skippedTier(): TierOutcome {
  return { answered: false, profiles: new Map() }
}

/** Caller's relays first; pubkeys they miss go to the indexer relays. */
async function fetchChunkProfiles(
  relays: string[],
  hexPubkeys: string[]
): Promise<ChunkOutcome> {
  const primary =
    relays.length > 0
      ? await settleTier(() => fetchFromRelays(relays, hexPubkeys))
      : skippedTier()
  const missing = hexPubkeys.filter((pk) => !primary.profiles.has(pk))
  const secondary =
    missing.length > 0
      ? await settleTier(() => fetchFromIndexerRelays(missing))
      : skippedTier()
  const answered = primary.answered || secondary.answered
  return {
    answered,
    error: answered ? undefined : (primary.error ?? secondary.error),
    found: new Map([...primary.profiles, ...secondary.profiles])
  }
}

// FLUSH

function recordOutcome(hexPubkeys: string[], outcome: ChunkOutcome): void {
  const now = Date.now()
  for (const pk of hexPubkeys) {
    if (outcome.answered || outcome.found.has(pk)) {
      answeredAt.set(pk, now)
      backoff.delete(pk)
      continue
    }
    const attempts = (backoff.get(pk)?.attempts ?? 0) + 1
    backoff.set(pk, {
      attempts,
      error: outcome.error ?? 'unknown',
      retryAt: now + getBackoffDelay(attempts)
    })
  }
  for (const [pk, entry] of outcome.found) {
    cacheProfile(pk, entry.profile, entry.eventId, entry.createdAt)
  }
}

function resultFor(hexPubkey: string, outcome: ChunkOutcome): ProfileResult {
  const fetched = outcome.found.get(hexPubkey)
  const cached = getCachedProfile(hexPubkey)
  if (fetched) {
    const cachedIsNewer = cached && cached.created_at > fetched.createdAt
    return {
      data: cachedIsNewer ? toProfile(cached) : fetched.profile,
      source: 'relay'
    }
  }
  if (outcome.answered) {
    return cached
      ? { data: toProfile(cached), source: 'stale' }
      : { data: null, source: 'relay' }
  }
  return {
    data: cached ? toProfile(cached) : null,
    error: outcome.error ?? 'unknown',
    source: cached ? 'stale' : 'cache'
  }
}

function deliverBatch(results: Map<string, ProfileResult>): void {
  const batch: ProfileBatch = new Map()
  const listeners = new Set<BatchCallback>()
  for (const [pk, result] of results) {
    if (result.source === 'relay' && result.data) {
      batch.set(pk, result.data)
    }
    for (const onBatch of inFlight.get(pk)?.callbacks ?? []) {
      listeners.add(onBatch)
    }
  }
  if (batch.size === 0) {
    return
  }
  for (const onBatch of listeners) {
    try {
      onBatch(batch)
    } catch {
      // A broken UI callback must not break the flush for everyone else.
    }
  }
}

function resolveWaiters(
  hexPubkeys: string[],
  results: Map<string, ProfileResult>
): void {
  for (const pk of hexPubkeys) {
    const request = inFlight.get(pk)
    if (!request) {
      continue
    }
    inFlight.delete(pk)
    const result = results.get(pk) ?? getCachedResult(pk)
    for (const waiter of request.waiters) {
      waiter(result)
    }
  }
}

async function flushChunk(
  relays: string[],
  hexPubkeys: string[]
): Promise<void> {
  const results = new Map<string, ProfileResult>()
  try {
    const outcome = await fetchChunkProfiles(relays, hexPubkeys)
    recordOutcome(hexPubkeys, outcome)
    for (const pk of hexPubkeys) {
      results.set(pk, resultFor(pk, outcome))
    }
    deliverBatch(results)
  } finally {
    resolveWaiters(hexPubkeys, results)
  }
}

async function flushGroup(
  relays: string[],
  hexPubkeys: string[]
): Promise<void> {
  try {
    for (const part of chunk(hexPubkeys, NOSTR_PROFILE_BATCH_SIZE)) {
      await flushChunk(relays, part)
    }
  } finally {
    resolveWaiters(hexPubkeys, new Map())
  }
}

async function flush(): Promise<void> {
  if (flushState.timer) {
    clearTimeout(flushState.timer)
    flushState.timer = null
  }
  if (pending.size === 0) {
    return
  }

  const groups = new Map<string, { hexPubkeys: string[]; relays: string[] }>()
  for (const [pk, request] of pending) {
    inFlight.set(pk, request)
    const key = [...request.relays].toSorted().join(',')
    const group = groups.get(key) ?? { hexPubkeys: [], relays: request.relays }
    group.hexPubkeys.push(pk)
    groups.set(key, group)
  }
  pending.clear()

  await Promise.allSettled(
    [...groups.values()].map(({ relays, hexPubkeys }) =>
      flushGroup(relays, hexPubkeys)
    )
  )
}

function scheduleFlush(): void {
  if (pending.size >= NOSTR_PROFILE_BATCH_FLUSH_AT) {
    void flush()
    return
  }
  if (flushState.timer) {
    return
  }
  flushState.timer = setTimeout(() => {
    flushState.timer = null
    void flush()
  }, NOSTR_PROFILE_BATCH_BUFFER_MS)
}

function requestProfile(
  hexPubkey: string,
  relays: string[],
  waiter?: ProfileWaiter,
  onBatch?: BatchCallback
): void {
  const cached = getCachedProfile(hexPubkey)
  if (cached && isCacheFresh(cached)) {
    waiter?.({ data: toProfile(cached), source: 'cache' })
    return
  }

  const joinable = inFlight.get(hexPubkey) ?? pending.get(hexPubkey)
  if (joinable) {
    if (waiter) {
      joinable.waiters.push(waiter)
    }
    if (onBatch) {
      joinable.callbacks.add(onBatch)
    }
    return
  }

  if (isLoadThrottled(hexPubkey)) {
    waiter?.(getCachedResult(hexPubkey))
    return
  }

  pending.set(hexPubkey, {
    callbacks: new Set(onBatch ? [onBatch] : []),
    relays,
    waiters: waiter ? [waiter] : []
  })
  scheduleFlush()
}

// PUBLIC API

/**
 * Kind 0 for one pubkey through the shared batcher: fresh cache answers
 * immediately, concurrent callers share one REQ, a pubkey relays answered
 * is not reloaded within the TTL, and failures back off exponentially.
 */
function fetchProfileResult(
  hexPubkey: string,
  relays: string[] = []
): Promise<ProfileResult> {
  const pk = hexPubkey.toLowerCase()
  if (!isValidHex(pk)) {
    return Promise.resolve({ data: null, source: 'relay' })
  }
  return new Promise((resolve) => {
    requestProfile(pk, relays, resolve)
  })
}

async function fetchProfileCoalesced(
  hexPubkey: string,
  relays: string[] = []
): Promise<NostrKind0Profile | null> {
  const { data } = await fetchProfileResult(hexPubkey, relays)
  return data
}

async function fetchProfilesCoalesced(
  hexPubkeys: string[],
  relays: string[] = []
): Promise<ProfileBatch> {
  const valid = [
    ...new Set(hexPubkeys.map((pk) => pk.toLowerCase()).filter(isValidHex))
  ]
  const results = await Promise.all(
    valid.map((pk) => fetchProfileResult(pk, relays))
  )
  const batch: ProfileBatch = new Map()
  for (const [index, { data }] of results.entries()) {
    if (data) {
      batch.set(valid[index], data)
    }
  }
  return batch
}

function queueProfileFetch(
  hexPubkey: string,
  { onBatch, relays = [] }: ProfileFetchOptions = {}
): void {
  const pk = hexPubkey.toLowerCase()
  if (!isValidHex(pk)) {
    return
  }
  requestProfile(pk, relays, undefined, onBatch)
}

function queueProfileFetches(
  hexPubkeys: string[],
  options: ProfileFetchOptions = {}
): void {
  for (const hex of hexPubkeys) {
    queueProfileFetch(hex, options)
  }
}

/** The user explicitly opened this pubkey: skip the TTL and backoff once. */
function forceProfileFetch(
  hexPubkey: string,
  options: ProfileFetchOptions = {}
): void {
  const pk = hexPubkey.toLowerCase()
  backoff.delete(pk)
  answeredAt.delete(pk)
  queueProfileFetch(pk, options)
}

/** Drops all in-memory loader state (cache screen, tests). */
function resetProfileFetcher(): void {
  pending.clear()
  inFlight.clear()
  backoff.clear()
  answeredAt.clear()
  if (flushState.timer) {
    clearTimeout(flushState.timer)
    flushState.timer = null
  }
}

export {
  fetchProfileCoalesced,
  fetchProfileResult,
  fetchProfilesCoalesced,
  forceProfileFetch,
  queueProfileFetch,
  queueProfileFetches,
  resetProfileFetcher
}
export type { ProfileResult }
