/**
 * Source flag for the identity feed fetchers: relay data comes back as
 * 'relay', relay failures fall back to the cache with an error code.
 */
import { type NDKFilter } from '@nostr-dev-kit/ndk'

jest.mock<typeof import('@/api/ndkRegistry')>('@/api/ndkRegistry', () => ({
  clearNdkRegistry: jest.fn(),
  createEphemeralNdk: jest.fn(),
  createMobileNdk: jest.fn(),
  disconnectNdkPool: jest.fn(),
  getOrCreateNdk: jest.fn(),
  ndkRegistry: new Map(),
  resetNdkForRelays: jest.fn()
}))

jest.mock<typeof import('@/api/nostrRelayHealth')>(
  '@/api/nostrRelayHealth',
  () => ({
    ...jest.requireActual<typeof import('@/api/nostrRelayHealth')>(
      '@/api/nostrRelayHealth'
    ),
    connectToFirstRelay: jest.fn()
  })
)

jest.mock<typeof import('@/db/nostrCache')>('@/db/nostrCache', () => ({
  ...jest.requireActual<typeof import('@/db/nostrCache')>('@/db/nostrCache'),
  cacheEvents: jest.fn(),
  deleteCachedEventsByAuthor: jest.fn(),
  getCachedNotes: jest.fn(),
  getCachedNotesByAuthors: jest.fn(),
  getNewestCachedTimestamp: jest.fn()
}))

import { getOrCreateNdk } from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import { connectToFirstRelay } from '@/api/nostrRelayHealth'
import {
  type CachedEvent,
  deleteCachedEventsByAuthor,
  getCachedNotes,
  getCachedNotesByAuthors,
  getNewestCachedTimestamp
} from '@/db/nostrCache'
import { getNostrFollowCache, setNostrFollowCache } from '@/storage/mmkv'
import { NostrNoRelaysError } from '@/utils/errors'

const SELF = '1'.repeat(64)
const FRIEND_A = 'a'.repeat(64)
const FRIEND_B = 'b'.repeat(64)
// The nostr-tools test mock decodes `npub1<hex>` back to <hex>.
const SELF_NPUB = `npub1${SELF}`
const RELAYS = ['wss://relay.one']
const NOTE_KEEP = 'c'.repeat(64)
const NOTE_DELETED = 'd'.repeat(64)

type FakeEvent = {
  content: string
  created_at: number
  id: string
  kind: number
  pubkey: string
  tags: string[][]
}

function makeEvent(overrides: Partial<FakeEvent>): FakeEvent {
  return {
    content: '',
    created_at: 100,
    id: 'e'.repeat(64),
    kind: 1,
    pubkey: SELF,
    tags: [],
    ...overrides
  }
}

function cachedNote(id: string, createdAt: number): CachedEvent {
  return {
    content: 'cached',
    created_at: createdAt,
    event_id: id,
    is_own: 1,
    kind: 1,
    pubkey: SELF,
    tags: []
  }
}

/** Answers each REQ with the events matching its kinds (if any), then EOSE. */
function makeFakeNdk(events: FakeEvent[]) {
  const filters: NDKFilter[] = []
  return {
    filters,
    pool: {
      connectedRelays: () => [{ url: RELAYS[0] }]
    },
    subscribe: jest.fn((filter: NDKFilter) => {
      filters.push(filter)
      const handlers: Record<string, ((arg: unknown) => void)[]> = {}
      queueMicrotask(() => {
        for (const event of events) {
          if (!filter.kinds || filter.kinds.includes(event.kind)) {
            for (const fn of handlers.event ?? []) {
              fn(event)
            }
          }
        }
        for (const fn of handlers.eose ?? []) {
          fn(undefined)
        }
      })
      return {
        on: (name: string, fn: (arg: unknown) => void) => {
          ;(handlers[name] ??= []).push(fn)
        },
        stop: jest.fn()
      }
    })
  }
}

function relaysUp(events: FakeEvent[]) {
  const ndk = makeFakeNdk(events)
  jest.mocked(getOrCreateNdk).mockReturnValue(ndk)
  jest.mocked(connectToFirstRelay).mockResolvedValue()
  return ndk
}

function relaysDown() {
  jest.mocked(getOrCreateNdk).mockReturnValue(makeFakeNdk([]))
  jest
    .mocked(connectToFirstRelay)
    .mockRejectedValue(new NostrNoRelaysError('offline'))
}

describe('nostr feed fetchers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getCachedNotes).mockReturnValue([])
    jest.mocked(getCachedNotesByAuthors).mockReturnValue([])
    jest.mocked(getNewestCachedTimestamp).mockReturnValue(null)
  })

  describe('fetchKind3FollowingPubkeys', () => {
    it('returns the relay follow list and caches it', async () => {
      relaysUp([
        makeEvent({
          kind: 3,
          tags: [
            ['p', FRIEND_A],
            ['p', FRIEND_B.toUpperCase()],
            ['p', FRIEND_A],
            ['p', SELF]
          ]
        })
      ])

      const result = await new NostrAPI(RELAYS).fetchKind3FollowingPubkeys(
        SELF_NPUB
      )

      expect(result.source).toBe('relay')
      expect(result.error).toBeUndefined()
      expect(result.data.kind3Found).toBe(true)
      expect(result.data.pubkeys).toStrictEqual([FRIEND_A, FRIEND_B])
      expect(getNostrFollowCache(SELF_NPUB)).toStrictEqual([FRIEND_A, FRIEND_B])
    })

    it('caches an empty follow list when the kind 3 follows nobody', async () => {
      setNostrFollowCache(SELF_NPUB, [FRIEND_A])
      relaysUp([makeEvent({ kind: 3, tags: [] })])

      const result = await new NostrAPI(RELAYS).fetchKind3FollowingPubkeys(
        SELF_NPUB
      )

      expect(result.data.pubkeys).toStrictEqual([])
      expect(getNostrFollowCache(SELF_NPUB)).toStrictEqual([])
    })

    it('keeps the cached follows (never an empty list) when relays fail', async () => {
      setNostrFollowCache(SELF_NPUB, [FRIEND_A, FRIEND_B])
      relaysDown()

      const result = await new NostrAPI(RELAYS).fetchKind3FollowingPubkeys(
        SELF_NPUB
      )

      expect(result).toStrictEqual({
        data: {
          connectedRelayCount: 0,
          kind3Found: false,
          pubkeys: [FRIEND_A, FRIEND_B],
          relaysQueried: RELAYS
        },
        error: 'noRelays',
        source: 'cache'
      })
      expect(getNostrFollowCache(SELF_NPUB)).toStrictEqual([FRIEND_A, FRIEND_B])
    })
  })

  describe('fetchNotes', () => {
    it('merges relay notes with the cache and drops notes the author deleted', async () => {
      jest
        .mocked(getCachedNotes)
        .mockReturnValue([
          cachedNote(NOTE_KEEP, 50),
          cachedNote(NOTE_DELETED, 40)
        ])
      relaysUp([
        makeEvent({ created_at: 200, id: 'f'.repeat(64), kind: 1 }),
        makeEvent({ kind: 5, tags: [['e', NOTE_DELETED]] })
      ])

      const result = await new NostrAPI(RELAYS, [SELF]).fetchNotes(SELF_NPUB)

      expect(result.source).toBe('relay')
      expect(result.data.map((note) => note.id)).toStrictEqual([
        'f'.repeat(64),
        NOTE_KEEP
      ])
      expect(deleteCachedEventsByAuthor).toHaveBeenCalledWith(
        [NOTE_DELETED],
        SELF
      )
    })

    it('only asks relays for notes newer than the cached head', async () => {
      jest.mocked(getNewestCachedTimestamp).mockReturnValue(500)
      const ndk = relaysUp([])

      await new NostrAPI(RELAYS).fetchNotes(SELF_NPUB)

      const noteFilter = ndk.filters.find((f) => f.kinds?.includes(1))
      expect(noteFilter?.since).toBe(501)
    })

    it('returns cached notes flagged as cache when relays fail', async () => {
      jest.mocked(getCachedNotes).mockReturnValue([cachedNote(NOTE_KEEP, 50)])
      relaysDown()

      const result = await new NostrAPI(RELAYS).fetchNotes(SELF_NPUB)

      expect(result.source).toBe('cache')
      expect(result.error).toBe('noRelays')
      expect(result.data.map((note) => note.id)).toStrictEqual([NOTE_KEEP])
    })
  })

  describe('fetchFollowingTimelineNotes', () => {
    it('falls back to cached notes from the same authors when relays fail', async () => {
      jest
        .mocked(getCachedNotesByAuthors)
        .mockReturnValue([{ ...cachedNote(NOTE_KEEP, 50), pubkey: FRIEND_A }])
      relaysDown()

      const result = await new NostrAPI(RELAYS).fetchFollowingTimelineNotes([
        FRIEND_A
      ])

      expect(result.source).toBe('cache')
      expect(result.data.map((note) => note.id)).toStrictEqual([NOTE_KEEP])
      expect(getCachedNotesByAuthors).toHaveBeenCalledWith(
        [FRIEND_A],
        [1],
        expect.any(Number),
        undefined
      )
    })
  })

  describe('fetchEventBatch', () => {
    it('returns what was found with source relay', async () => {
      relaysUp([makeEvent({ id: NOTE_KEEP, kind: 1 })])

      const result = await new NostrAPI(RELAYS).fetchEventBatch([NOTE_KEEP])

      expect(result.source).toBe('relay')
      expect(result.data.get(NOTE_KEEP)?.id).toBe(NOTE_KEEP)
    })
  })

  describe('fetchInboxRelaysForNpub', () => {
    it('returns no relays (callers use defaults) when relays are unreachable', async () => {
      relaysDown()

      await expect(
        new NostrAPI(RELAYS).fetchInboxRelaysForNpub(SELF_NPUB)
      ).resolves.toStrictEqual([])
    })
  })
})
