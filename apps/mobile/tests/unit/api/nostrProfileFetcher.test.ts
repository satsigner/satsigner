/**
 * Tests for the batched kind-0 profile loader. Relay access is mocked at
 * the ndkRegistry seam (the module the loader uses for both tiers).
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

jest.mock<typeof import('@/db/nostrCache')>('@/db/nostrCache', () => ({
  cacheProfile: jest.fn(),
  getCachedProfile: jest.fn()
}))

import { createEphemeralNdk, getOrCreateNdk } from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import {
  fetchProfileCoalesced,
  fetchProfileResult,
  fetchProfilesCoalesced,
  forceProfileFetch,
  queueProfileFetch,
  resetProfileFetcher
} from '@/api/nostrProfileFetcher'
import {
  NOSTR_INDEXER_RELAYS,
  NOSTR_PROFILE_BACKOFF_BASE_MS,
  NOSTR_PROFILE_CACHE_TTL_SECS
} from '@/constants/nostr'
import { cacheProfile, getCachedProfile } from '@/db/nostrCache'
import { NostrNoRelaysError } from '@/utils/errors'

const PK_A = 'a'.repeat(64)
const PK_B = 'b'.repeat(64)
const PK_C = 'c'.repeat(64)
const USER_RELAYS = ['wss://user.relay']
const MS_PER_SECOND = 1000
const TTL_MS = NOSTR_PROFILE_CACHE_TTL_SECS * MS_PER_SECOND

type FakeEvent = { content: unknown; created_at: number }

function makeFakeNdk(
  eventsByHex: Record<string, FakeEvent[]>,
  opts: { gate?: Promise<void>; holdOpen?: boolean } = {}
) {
  const subscribes: NDKFilter[] = []
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    pool: {
      connectedRelays: jest.fn(() => [{ url: 'wss://fake' }]),
      off: jest.fn(),
      on: jest.fn(),
      relays: new Map([['wss://fake', {}]]),
      removeAllListeners: jest.fn()
    },
    subscribe: jest.fn((filter: NDKFilter) => {
      subscribes.push(filter)
      const handlers: Record<string, ((arg: unknown) => void)[]> = {}
      const sub = {
        on: jest.fn((name: string, fn: (arg: unknown) => void) => {
          ;(handlers[name] ??= []).push(fn)
        }),
        stop: jest.fn()
      }
      void (opts.gate ?? Promise.resolve()).then(() => {
        for (const author of (filter.authors as string[]) ?? []) {
          for (const event of eventsByHex[author] ?? []) {
            for (const fn of handlers.event ?? []) {
              fn({
                content: JSON.stringify(event.content),
                created_at: event.created_at,
                id: `ev-${author.slice(0, 8)}-${event.created_at}`,
                pubkey: author
              })
            }
          }
        }
        if (!opts.holdOpen) {
          for (const fn of handlers.eose ?? []) {
            fn(undefined)
          }
        }
      })
      return sub
    }),
    subscribes
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Waits past the 200ms batch buffer so a queued flush runs. */
async function flushNow() {
  await sleep(300)
}

function failRelays() {
  jest.mocked(getOrCreateNdk).mockImplementation(() => {
    throw new NostrNoRelaysError('offline')
  })
  jest.mocked(createEphemeralNdk).mockImplementation(() => {
    throw new NostrNoRelaysError('offline')
  })
}

describe('nostrProfileFetcher', () => {
  const realNow = Date.now.bind(Date)
  const clock = { offset: 0 }

  function fakeNow() {
    return realNow() + clock.offset
  }

  beforeEach(() => {
    resetProfileFetcher()
    jest.clearAllMocks()
    jest.mocked(getCachedProfile).mockReturnValue(null)
    jest.mocked(cacheProfile).mockReturnValue(undefined)
    jest.mocked(createEphemeralNdk).mockReturnValue(makeFakeNdk({}))
    clock.offset = 0
    jest.spyOn(Date, 'now').mockImplementation(fakeNow)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('batching', () => {
    it('batches multiple queueProfileFetch calls into one relay fetch', async () => {
      const userNdk = makeFakeNdk({})
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)

      queueProfileFetch(PK_A, { relays: USER_RELAYS })
      queueProfileFetch(PK_B, { relays: USER_RELAYS })
      queueProfileFetch(PK_C, { relays: USER_RELAYS })
      await flushNow()

      expect(userNdk.subscribe).toHaveBeenCalledTimes(1)
      expect(userNdk.subscribes[0].authors).toStrictEqual(
        expect.arrayContaining([PK_A, PK_B, PK_C])
      )
    })

    it('joins a batch already in flight instead of sending a second REQ', async () => {
      const gate: { release: () => void } = { release: () => undefined }
      const userNdk = makeFakeNdk(
        { [PK_A]: [{ content: { name: 'alice' }, created_at: 100 }] },
        {
          gate: new Promise((resolve) => {
            gate.release = resolve
          })
        }
      )
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)

      const first = fetchProfileCoalesced(PK_A, USER_RELAYS)
      await flushNow()
      expect(userNdk.subscribe).toHaveBeenCalledTimes(1)
      const second = fetchProfileCoalesced(PK_A, USER_RELAYS)
      gate.release()

      await expect(first).resolves.toMatchObject({ displayName: 'alice' })
      await expect(second).resolves.toMatchObject({ displayName: 'alice' })
      expect(userNdk.subscribe).toHaveBeenCalledTimes(1)
    })
  })

  describe('ttl and backoff', () => {
    it('does not reload a pubkey relays answered within the TTL', async () => {
      const userNdk = makeFakeNdk({})
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)

      await fetchProfileResult(PK_A, USER_RELAYS)
      await fetchProfileResult(PK_A, USER_RELAYS)
      expect(userNdk.subscribe).toHaveBeenCalledTimes(1)

      clock.offset = TTL_MS + 1
      await fetchProfileResult(PK_A, USER_RELAYS)
      expect(userNdk.subscribe).toHaveBeenCalledTimes(2)
    })

    it('backs off exponentially after relay failures', async () => {
      failRelays()

      await fetchProfileResult(PK_A, USER_RELAYS)
      expect(getOrCreateNdk).toHaveBeenCalledTimes(1)

      await fetchProfileResult(PK_A, USER_RELAYS)
      expect(getOrCreateNdk).toHaveBeenCalledTimes(1)

      clock.offset = NOSTR_PROFILE_BACKOFF_BASE_MS + 1
      await fetchProfileResult(PK_A, USER_RELAYS)
      expect(getOrCreateNdk).toHaveBeenCalledTimes(2)

      clock.offset += NOSTR_PROFILE_BACKOFF_BASE_MS + 1
      await fetchProfileResult(PK_A, USER_RELAYS)
      expect(getOrCreateNdk).toHaveBeenCalledTimes(2)

      clock.offset += NOSTR_PROFILE_BACKOFF_BASE_MS
      await fetchProfileResult(PK_A, USER_RELAYS)
      expect(getOrCreateNdk).toHaveBeenCalledTimes(3)
    })

    it('forceProfileFetch skips the backoff once', async () => {
      failRelays()
      await fetchProfileResult(PK_A, USER_RELAYS)

      forceProfileFetch(PK_A, { relays: USER_RELAYS })
      await flushNow()

      expect(getOrCreateNdk).toHaveBeenCalledTimes(2)
    })
  })

  describe('source flag', () => {
    it('reports relay data as source relay', async () => {
      jest.mocked(getOrCreateNdk).mockReturnValue(
        makeFakeNdk({
          [PK_A]: [{ content: { name: 'alice' }, created_at: 100 }]
        })
      )

      const result = await fetchProfileResult(PK_A, USER_RELAYS)

      expect(result.source).toBe('relay')
      expect(result.error).toBeUndefined()
      expect(result.data?.displayName).toBe('alice')
    })

    it('falls back to the stale cached profile with the error code when relays fail', async () => {
      failRelays()
      jest.mocked(getCachedProfile).mockReturnValue({
        cached_at: 0,
        created_at: 50,
        displayName: 'old-alice',
        pubkey: PK_A
      })

      const result = await fetchProfileResult(PK_A, USER_RELAYS)

      expect(result).toStrictEqual({
        data: expect.objectContaining({ displayName: 'old-alice' }),
        error: 'noRelays',
        source: 'stale'
      })
    })
  })

  describe('waiters', () => {
    it('always resolve, even when the flush throws', async () => {
      jest.mocked(getOrCreateNdk).mockReturnValue(
        makeFakeNdk({
          [PK_A]: [{ content: { name: 'alice' }, created_at: 100 }]
        })
      )
      jest.mocked(cacheProfile).mockImplementation(() => {
        throw new Error('db exploded')
      })

      await expect(fetchProfileCoalesced(PK_A, USER_RELAYS)).resolves.toBeNull()
    })
  })

  describe('two-tier relay routing', () => {
    it('falls back to indexer relays only for still-missing pubkeys', async () => {
      const userNdk = makeFakeNdk({
        [PK_A]: [{ content: { name: 'alice' }, created_at: 100 }]
      })
      const indexerNdk = makeFakeNdk({
        [PK_B]: [{ content: { name: 'bob' }, created_at: 100 }]
      })
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)
      jest.mocked(createEphemeralNdk).mockReturnValue(indexerNdk)

      const result = await fetchProfilesCoalesced([PK_A, PK_B], USER_RELAYS)

      expect(createEphemeralNdk).toHaveBeenCalledWith(NOSTR_INDEXER_RELAYS)
      expect(indexerNdk.subscribes[0].authors).toStrictEqual([PK_B])
      expect(result.get(PK_A)?.displayName).toBe('alice')
      expect(result.get(PK_B)?.displayName).toBe('bob')
    })
  })

  describe('newest-wins + cache behavior', () => {
    it('picks the newest kind-0 when several arrive for one pubkey', async () => {
      jest.mocked(getOrCreateNdk).mockReturnValue(
        makeFakeNdk({
          [PK_A]: [
            { content: { name: 'old-name' }, created_at: 100 },
            { content: { name: 'new-name' }, created_at: 200 }
          ]
        })
      )

      const profile = await fetchProfileCoalesced(PK_A, USER_RELAYS)
      expect(profile?.displayName).toBe('new-name')
    })

    it('keeps a newer cached profile over an older relay copy', async () => {
      jest.mocked(getOrCreateNdk).mockReturnValue(
        makeFakeNdk({
          [PK_A]: [{ content: { name: 'relay-old' }, created_at: 100 }]
        })
      )
      jest.mocked(getCachedProfile).mockReturnValue({
        cached_at: 0,
        created_at: 500,
        displayName: 'cached-new',
        pubkey: PK_A
      })

      const profile = await fetchProfileCoalesced(PK_A, USER_RELAYS)
      expect(profile?.displayName).toBe('cached-new')
    })

    it('writes found profiles back via cacheProfile', async () => {
      jest.mocked(getOrCreateNdk).mockReturnValue(
        makeFakeNdk({
          [PK_A]: [{ content: { name: 'alice' }, created_at: 100 }]
        })
      )

      await fetchProfileCoalesced(PK_A, USER_RELAYS)
      expect(cacheProfile).toHaveBeenCalledWith(
        PK_A,
        expect.objectContaining({ displayName: 'alice' }),
        expect.any(String),
        100
      )
    })

    it('skips relay traffic entirely for fresh cached profiles', async () => {
      jest.mocked(getCachedProfile).mockReturnValue({
        cached_at: Math.floor(Date.now() / MS_PER_SECOND),
        created_at: 1,
        displayName: 'cached-alice',
        pubkey: PK_A
      })

      const result = await fetchProfileResult(PK_A, USER_RELAYS)
      expect(result).toStrictEqual({
        data: expect.objectContaining({ displayName: 'cached-alice' }),
        source: 'cache'
      })
      expect(getOrCreateNdk).not.toHaveBeenCalled()
    })
  })

  describe('abort signal', () => {
    it('stops onBatch delivery after abort', async () => {
      jest
        .mocked(getOrCreateNdk)
        .mockReturnValue(
          makeFakeNdk(
            { [PK_A]: [{ content: { name: 'alice' }, created_at: 100 }] },
            { holdOpen: true }
          )
        )

      const api = new NostrAPI(USER_RELAYS)
      const onBatch = jest.fn()
      const controller = new AbortController()

      const stream = api.streamKind0Profiles([PK_A], onBatch, controller.signal)
      controller.abort()
      await stream
      await flushNow()

      expect(onBatch).not.toHaveBeenCalled()
    })
  })
})
