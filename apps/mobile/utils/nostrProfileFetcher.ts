import type NDK from '@nostr-dev-kit/ndk'
import { type NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk'

import {
  createEphemeralNdk,
  disconnectNdkPool,
  getOrCreateNdk
} from '@/api/ndkRegistry'
import {
  NOSTR_INDEXER_RELAYS,
  NOSTR_PROFILE_BATCH_SIZE,
  NOSTR_PROFILE_CACHE_TTL_SECS
} from '@/constants/nostr'
import { cacheProfile, getCachedProfile } from '@/db/nostrCache'
import { type NostrKind0Profile } from '@/types/models/Nostr'
import { chunkArray } from '@/utils/chunkArray'
import { getProfileFromKind0Content } from '@/utils/nostr'

// CONFIG

const QUEUE_DEBOUNCE_MS = 100
const QUEUE_FLUSH_AT = 100
const MAX_ATTEMPTS_PER_PUBKEY = 2
// EOSE closes the fetch as soon as relays finish; the timeout is only a
// backstop, so cache hits return as fast as relays answer.
const FETCH_EOSE_TIMEOUT_MS = 5_000
// Longer cap for cold ephemeral connections to the indexer tier.
const EPHEMERAL_CONNECT_TIMEOUT_MS = 8_000

type ProfileBatch = Map<string, NostrKind0Profile>
type BatchCallback = (batch: ProfileBatch) => void
type ProfileWaiter = { resolve: (profile: NostrKind0Profile | null) => void }

type PendingEntry = {
  onBatch?: BatchCallback
  relays: string[]
  waiters: ProfileWaiter[]
}

// STATE

const pending = new Map<string, PendingEntry>()
const inFlight = new Set<string>()
const attempts = new Map<string, number>()
const exhausted = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

function isValidHex(hexPubkey: string): boolean {
  return /^[0-9a-f]{64}$/.test(hexPubkey)
}

function getFreshCached(hexPubkey: string): NostrKind0Profile | null {
  const cached = getCachedProfile(hexPubkey)
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
  return null
}

/** Stale cache allowed — used as the final fallback when relays come up empty. */
function getStaleCached(hexPubkey: string): NostrKind0Profile | null {
  const cached = getCachedProfile(hexPubkey)
  if (!cached) {
    return null
  }
  return {
    banner: cached.banner,
    displayName: cached.displayName,
    lud16: cached.lud16,
    nip05: cached.nip05,
    picture: cached.picture
  }
}
type FetchedProfile = {
  createdAt: number
  eventId: string
  profile: NostrKind0Profile
}
type FetchResult = Map<string, FetchedProfile>

// FETCH

/**
 * Subscribe-collect-until-EOSE. Resolves as soon as a connected relay sends
 * EOSE (hits return immediately) or after the backstop timeout.
 */
function fetchKind0Events(
  ndk: NDK,
  hexPubkeys: string[],
  timeoutMs: number
): Promise<FetchResult> {
  return new Promise((resolve) => {
    let settled = false
    const newest: FetchResult = new Map()
    const filter: NDKFilter = {
      authors: hexPubkeys,
      kinds: [0],
      limit: hexPubkeys.length
    }
    const sub = ndk.subscribe(filter, { closeOnEose: false })

    const finish = () => {
      if (settled) {
        return
      }
      settled = true
      sub.stop()
      resolve(newest)
    }

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
        finish()
      }
    })
    setTimeout(finish, timeoutMs)
  })
}

async function fetchFromIndexerRelays(
  hexPubkeys: string[]
): Promise<FetchResult> {
  const ephemeral = createEphemeralNdk(NOSTR_INDEXER_RELAYS)
  try {
    await ephemeral.connect(EPHEMERAL_CONNECT_TIMEOUT_MS)
    return await fetchKind0Events(ephemeral, hexPubkeys, FETCH_EOSE_TIMEOUT_MS)
  } finally {
    disconnectNdkPool(ephemeral)
  }
}

// FLUSH

async function flushChunk(relaySetKey: string, hexes: string[]): Promise<void> {
  const relays = relaySetKey ? relaySetKey.split(',') : []
  const fetched: FetchResult = new Map()

  // Attempt 1: the caller's relay pool (shared NDK). Empty pools skip
  // straight to the indexer tier rather than timing out for nothing.
  if (relays.length > 0) {
    const first = await fetchKind0Events(
      getOrCreateNdk(relays),
      hexes,
      FETCH_EOSE_TIMEOUT_MS
    )
    for (const [pk, entry] of first) {
      fetched.set(pk, entry)
    }
  }
  for (const pk of hexes) {
    attempts.set(pk, (attempts.get(pk) ?? 0) + 1)
  }

  // Attempt 2: indexer relays, only for still-missing, attempt-capped pubkeys.
  const missing = hexes.filter(
    (pk) =>
      !fetched.has(pk) && (attempts.get(pk) ?? 0) < MAX_ATTEMPTS_PER_PUBKEY
  )
  if (missing.length > 0) {
    const second = await fetchFromIndexerRelays(missing)
    for (const [pk, entry] of second) {
      fetched.set(pk, entry)
    }
  }
  for (const pk of missing) {
    attempts.set(pk, (attempts.get(pk) ?? 0) + 1)
  }

  // Newest-wins merge is already applied inside fetchKind0Events; write back
  // with real event metadata.
  const found: ProfileBatch = new Map()
  for (const [pk, entry] of fetched) {
    cacheProfile(pk, entry.profile, entry.eventId, entry.createdAt)
    found.set(pk, entry.profile)
  }

  const callbacks = new Set<BatchCallback>()
  for (const pk of hexes) {
    const entry = pendingEntriesFor(pk)
    if (entry?.onBatch) {
      callbacks.add(entry.onBatch)
    }
  }
  if (found.size > 0) {
    for (const onBatch of callbacks) {
      try {
        onBatch(found)
      } catch {
        // A broken UI callback must not break the flush for everyone else.
      }
    }
  }

  for (const pk of hexes) {
    const profile = found.get(pk) ?? getStaleCached(pk)
    const entry = pendingEntriesFor(pk)
    if (!entry) {
      continue
    }
    for (const waiter of entry.waiters) {
      waiter.resolve(profile)
    }
    if (!found.has(pk) && (attempts.get(pk) ?? 0) >= MAX_ATTEMPTS_PER_PUBKEY) {
      exhausted.add(pk)
    }
  }
}

// Track the pending entries attached to each flush chunk.
const chunkEntries = new Map<string, PendingEntry>()

function pendingEntriesFor(hexPubkey: string): PendingEntry | undefined {
  return chunkEntries.get(hexPubkey)
}

async function flush(): Promise<void> {
  if (pending.size === 0) {
    return
  }
  const entries = new Map(pending)
  pending.clear()

  // Group by relay set so same-set callers share one fetch.
  const groups = new Map<string, string[]>()
  for (const [pk, entry] of entries) {
    const key = [...entry.relays].toSorted().join(',')
    const group = groups.get(key) ?? []
    group.push(pk)
    groups.set(key, group)
    chunkEntries.set(pk, entry)
    inFlight.add(pk)
  }

  try {
    for (const [relaySetKey, hexes] of groups) {
      for (const chunk of chunkArray(hexes, NOSTR_PROFILE_BATCH_SIZE)) {
        await flushChunk(relaySetKey, chunk)
      }
    }
  } finally {
    for (const pk of entries.keys()) {
      inFlight.delete(pk)
      chunkEntries.delete(pk)
    }
  }
}

function scheduleFlush(): void {
  if (pending.size >= QUEUE_FLUSH_AT) {
    void flush()
    return
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null
      void flush()
    }, QUEUE_DEBOUNCE_MS)
  }
}

// PUBLIC API

function queueProfileFetch(
  hexPubkey: string,
  opts: { onBatch?: BatchCallback; relays?: string[] } = {}
): void {
  const pk = hexPubkey.toLowerCase()
  if (!isValidHex(pk)) {
    return
  }
  if (getFreshCached(pk) || inFlight.has(pk) || exhausted.has(pk)) {
    return
  }
  const existing = pending.get(pk)
  if (existing) {
    return
  }
  pending.set(pk, {
    onBatch: opts.onBatch,
    relays: opts.relays ?? [],
    waiters: []
  })
  scheduleFlush()
}

function queueProfileFetches(
  hexPubkeys: string[],
  opts: { onBatch?: BatchCallback; relays?: string[] } = {}
): void {
  for (const hex of hexPubkeys) {
    queueProfileFetch(hex, opts)
  }
}

function fetchProfileCoalesced(
  hexPubkey: string,
  relays: string[] = []
): Promise<NostrKind0Profile | null> {
  const pk = hexPubkey.toLowerCase()
  if (!isValidHex(pk)) {
    return Promise.resolve(null)
  }
  const fresh = getFreshCached(pk)
  if (fresh) {
    return Promise.resolve(fresh)
  }
  if (exhausted.has(pk)) {
    return Promise.resolve(getStaleCached(pk))
  }
  return new Promise((resolve) => {
    // Attach to the in-flight flush entry when one is already running.
    const running = chunkEntries.get(pk)
    if (running && inFlight.has(pk)) {
      running.waiters.push({ resolve })
      return
    }
    const existing = pending.get(pk)
    if (existing) {
      existing.waiters.push({ resolve })
    } else {
      pending.set(pk, { relays, waiters: [{ resolve }] })
    }
    scheduleFlush()
  })
}

async function fetchProfilesCoalesced(
  hexPubkeys: string[],
  relays: string[] = []
): Promise<ProfileBatch> {
  const valid = hexPubkeys
    .map((pk) => pk.toLowerCase())
    .filter((pk) => isValidHex(pk))
  const profiles = await Promise.all(
    valid.map((pk) => fetchProfileCoalesced(pk, relays))
  )
  const result: ProfileBatch = new Map()
  for (const [index, profile] of profiles.entries()) {
    if (profile) {
      result.set(valid[index], profile)
    }
  }
  return result
}

/** Re-queue a pubkey the user explicitly opened: clears exhausted/attempts. */
function forceProfileFetch(
  hexPubkey: string,
  opts: { onBatch?: BatchCallback; relays?: string[] } = {}
): void {
  const pk = hexPubkey.toLowerCase()
  exhausted.delete(pk)
  attempts.delete(pk)
  queueProfileFetch(pk, opts)
}

/** Test/support hook: reset all session state. */
function resetProfileFetcher(): void {
  pending.clear()
  inFlight.clear()
  attempts.clear()
  exhausted.clear()
  chunkEntries.clear()
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

export {
  fetchProfileCoalesced,
  fetchProfilesCoalesced,
  forceProfileFetch,
  queueProfileFetch,
  queueProfileFetches,
  resetProfileFetcher
}
export type { ProfileBatch }
