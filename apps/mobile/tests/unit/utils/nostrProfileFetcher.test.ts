/**
 * Tests for the coalescing kind-0 profile fetcher. Relay access is mocked at
 * the ndkRegistry seam (the module the fetcher uses for both tiers).
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
import { NOSTR_INDEXER_RELAYS } from '@/constants/nostr'
import { cacheProfile, getCachedProfile } from '@/db/nostrCache'
import {
  fetchProfileCoalesced,
  fetchProfilesCoalesced,
  forceProfileFetch,
  queueProfileFetch,
  resetProfileFetcher
} from '@/utils/nostrProfileFetcher'

const PK_A = 'a'.repeat(64)
const PK_B = 'b'.repeat(64)
const PK_C = 'c'.repeat(64)

type FakeEvent = { content: unknown; created_at: number }

function makeFakeNdk(
  eventsByHex: Record<string, FakeEvent[]>,
  opts: { holdOpen?: boolean } = {}
) {
  const subscribes: NDKFilter[] = []
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    pool: {
      connectedRelays: jest.fn(() => [{ url: 'wss://fake' }]),
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
      queueMicrotask(() => {
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

/** Waits past the 100ms debounce so a queued flush runs. */
async function flushNow() {
  await sleep(180)
}

describe('nostrProfileFetcher', () => {
  beforeEach(() => {
    resetProfileFetcher()
    jest.clearAllMocks()
    jest.mocked(getCachedProfile).mockReturnValue(undefined)
    jest.mocked(createEphemeralNdk).mockReturnValue(makeFakeNdk({}))
  })

  describe('queue coalescing', () => {
    it('batches multiple queueProfileFetch calls into one relay fetch', async () => {
      const userNdk = makeFakeNdk({})
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)

      queueProfileFetch(PK_A, { relays: ['wss://user.relay'] })
      queueProfileFetch(PK_B, { relays: ['wss://user.relay'] })
      queueProfileFetch(PK_C, { relays: ['wss://user.relay'] })
      await flushNow()

      expect(userNdk.subscribe).toHaveBeenCalledTimes(1)
      expect(userNdk.subscribes[0].authors).toStrictEqual(
        expect.arrayContaining([PK_A, PK_B, PK_C])
      )
    })
  })

  describe('in-flight dedupe, attempt cap, exhaustion', () => {
    it('never re-fetches an in-flight or pending pubkey', async () => {
      const userNdk = makeFakeNdk({})
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)

      queueProfileFetch(PK_A, { relays: ['wss://user.relay'] })
      queueProfileFetch(PK_A, { relays: ['wss://user.relay'] })
      await flushNow()
      // Second queue after the flush completed is exhausted (2 attempts spent).
      queueProfileFetch(PK_A, { relays: ['wss://user.relay'] })
      await flushNow()

      expect(userNdk.subscribe).toHaveBeenCalledTimes(1)
    })

    it('exhausts a dead pubkey after 2 attempts; forceProfileFetch re-enables', async () => {
      const userNdk = makeFakeNdk({})
      const indexerNdk = makeFakeNdk({})
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)
      jest.mocked(createEphemeralNdk).mockReturnValue(indexerNdk)

      queueProfileFetch(PK_A, { relays: ['wss://user.relay'] })
      await flushNow()
      expect(userNdk.subscribe).toHaveBeenCalledTimes(1)
      expect(indexerNdk.subscribe).toHaveBeenCalledTimes(1)

      // Exhausted: no further relay traffic.
      queueProfileFetch(PK_A, { relays: ['wss://user.relay'] })
      await flushNow()
      expect(userNdk.subscribe).toHaveBeenCalledTimes(1)
      expect(indexerNdk.subscribe).toHaveBeenCalledTimes(1)

      // Force re-enables exactly one more attempt cycle.
      forceProfileFetch(PK_A, { relays: ['wss://user.relay'] })
      await flushNow()
      expect(userNdk.subscribe).toHaveBeenCalledTimes(2)
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

      const result = await fetchProfilesCoalesced(
        [PK_A, PK_B],
        ['wss://user.relay']
      )

      expect(createEphemeralNdk).toHaveBeenCalledWith(NOSTR_INDEXER_RELAYS)
      // Only the missing pubkey goes to the indexer tier.
      expect(indexerNdk.subscribes[0].authors).toStrictEqual([PK_B])
      expect(result.get(PK_A)?.displayName).toBe('alice')
      expect(result.get(PK_B)?.displayName).toBe('bob')
    })
  })

  describe('newest-wins + cache behavior', () => {
    it('picks the newest kind-0 when several arrive for one pubkey', async () => {
      const userNdk = makeFakeNdk({
        [PK_A]: [
          { content: { name: 'old-name' }, created_at: 100 },
          { content: { name: 'new-name' }, created_at: 200 }
        ]
      })
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)

      const profile = await fetchProfileCoalesced(PK_A, ['wss://user.relay'])
      expect(profile?.displayName).toBe('new-name')
    })

    it('writes found profiles back via cacheProfile', async () => {
      const userNdk = makeFakeNdk({
        [PK_A]: [{ content: { name: 'alice' }, created_at: 100 }]
      })
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)

      await fetchProfileCoalesced(PK_A, ['wss://user.relay'])
      expect(cacheProfile).toHaveBeenCalledWith(
        PK_A,
        expect.objectContaining({ displayName: 'alice' }),
        expect.any(String),
        100
      )
    })

    it('skips relay traffic entirely for fresh cached profiles', async () => {
      const now = Math.floor(Date.now() / 1000)
      jest.mocked(getCachedProfile).mockReturnValue({
        cached_at: now,
        displayName: 'cached-alice',
        picture: undefined
      })

      const profile = await fetchProfileCoalesced(PK_A, ['wss://user.relay'])
      expect(profile?.displayName).toBe('cached-alice')
      expect(getOrCreateNdk).not.toHaveBeenCalled()
    })
  })

  describe('abort signal', () => {
    it('stops onBatch delivery after abort', async () => {
      const userNdk = makeFakeNdk(
        { [PK_A]: [{ content: { name: 'alice' }, created_at: 100 }] },
        { holdOpen: true }
      )
      jest.mocked(getOrCreateNdk).mockReturnValue(userNdk)

      const api = new NostrAPI(['wss://user.relay'])
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
