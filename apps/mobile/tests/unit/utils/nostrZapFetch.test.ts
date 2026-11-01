/**
 * Zap receipt fetchers: per-pubkey `since`, and cached receipts survive a
 * relay failure (flagged with source 'cache').
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
  getCachedZapReceipts: jest.fn(),
  getCachedZapsByPubkey: jest.fn(),
  getNewestCachedZapTimestamp: jest.fn()
}))

import { createEphemeralNdk } from '@/api/ndkRegistry'
import { connectToFirstRelay } from '@/api/nostrRelayHealth'
import {
  type CachedEvent,
  cacheEvents,
  getCachedZapReceipts,
  getCachedZapsByPubkey,
  getNewestCachedZapTimestamp
} from '@/db/nostrCache'
import { NostrNoRelaysError } from '@/utils/errors'
import { fetchZapReceipts, fetchZapsByPubkey } from '@/utils/nostrZap'

const PUBKEY_A = 'a'.repeat(64)
const PUBKEY_B = 'b'.repeat(64)
const ZAPPER = 'c'.repeat(64)
const NOTE_ID = 'd'.repeat(64)
const RELAYS = ['wss://relay.one']

function zapTags(target: string): string[][] {
  return [
    ['p', target],
    ['e', NOTE_ID],
    [
      'description',
      JSON.stringify({
        content: '',
        pubkey: ZAPPER,
        tags: [['amount', '21000']]
      })
    ]
  ]
}

function cachedZap(id: string, target: string, createdAt: number): CachedEvent {
  return {
    content: '',
    created_at: createdAt,
    event_id: id,
    is_own: 0,
    kind: 9735,
    pubkey: 'lnurl-server',
    tags: zapTags(target)
  }
}

function makeFakeNdk(events: object[]) {
  const filters: NDKFilter[] = []
  return {
    filters,
    pool: { connectedRelays: () => [{ url: RELAYS[0] }], relays: new Map() },
    subscribe: jest.fn((filter: NDKFilter) => {
      filters.push(filter)
      const handlers: Record<string, ((arg: unknown) => void)[]> = {}
      queueMicrotask(() => {
        for (const event of events) {
          for (const fn of handlers.event ?? []) {
            fn(event)
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

describe('zap receipt fetchers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getCachedZapsByPubkey).mockReturnValue([])
    jest.mocked(getCachedZapReceipts).mockReturnValue([])
    jest.mocked(getNewestCachedZapTimestamp).mockReturnValue(null)
  })

  describe('fetchZapsByPubkey', () => {
    it('asks relays only for receipts newer than this pubkey’s newest cached one', async () => {
      jest
        .mocked(getNewestCachedZapTimestamp)
        .mockImplementation((pk) => (pk === PUBKEY_A ? 1000 : null))
      const ndkA = makeFakeNdk([])
      const ndkB = makeFakeNdk([])
      jest
        .mocked(createEphemeralNdk)
        .mockReturnValueOnce(ndkA)
        .mockReturnValueOnce(ndkB)
      jest.mocked(connectToFirstRelay).mockResolvedValue()

      await fetchZapsByPubkey(PUBKEY_A, RELAYS, 20)
      await fetchZapsByPubkey(PUBKEY_B, RELAYS, 20)

      expect(getNewestCachedZapTimestamp).toHaveBeenCalledWith(PUBKEY_A)
      expect(getNewestCachedZapTimestamp).toHaveBeenCalledWith(PUBKEY_B)
      expect(ndkA.filters[0].since).toBe(1001)
      expect(ndkB.filters[0].since).toBeUndefined()
    })

    it('merges fresh receipts with the cache and caches the fresh ones', async () => {
      jest
        .mocked(getCachedZapsByPubkey)
        .mockReturnValue([cachedZap('z'.repeat(64), PUBKEY_A, 900)])
      jest.mocked(createEphemeralNdk).mockReturnValue(
        makeFakeNdk([
          {
            content: '',
            created_at: 1100,
            id: 'y'.repeat(64),
            kind: 9735,
            pubkey: 'lnurl-server',
            sig: 's',
            tags: zapTags(PUBKEY_A)
          }
        ])
      )
      jest.mocked(connectToFirstRelay).mockResolvedValue()

      const result = await fetchZapsByPubkey(PUBKEY_A, RELAYS, 20)

      expect(result.source).toBe('relay')
      expect(result.data.map((zap) => zap.id)).toStrictEqual([
        'y'.repeat(64),
        'z'.repeat(64)
      ])
      expect(cacheEvents).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 'y'.repeat(64) })],
        []
      )
    })

    it('keeps cached receipts when relays fail', async () => {
      jest
        .mocked(getCachedZapsByPubkey)
        .mockReturnValue([cachedZap('z'.repeat(64), PUBKEY_A, 900)])
      jest.mocked(createEphemeralNdk).mockReturnValue(makeFakeNdk([]))
      jest
        .mocked(connectToFirstRelay)
        .mockRejectedValue(new NostrNoRelaysError('offline'))

      const result = await fetchZapsByPubkey(PUBKEY_A, RELAYS, 20)

      expect(result.source).toBe('cache')
      expect(result.error).toBe('noRelays')
      expect(result.data.map((zap) => zap.id)).toStrictEqual(['z'.repeat(64)])
      expect(result.data[0]?.amountSats).toBe(21)
    })
  })

  describe('fetchZapReceipts', () => {
    it('keeps cached note receipts when relays fail', async () => {
      jest
        .mocked(getCachedZapReceipts)
        .mockReturnValue([cachedZap('z'.repeat(64), PUBKEY_A, 900)])
      jest.mocked(createEphemeralNdk).mockReturnValue(makeFakeNdk([]))
      jest
        .mocked(connectToFirstRelay)
        .mockRejectedValue(new NostrNoRelaysError('offline'))

      const result = await fetchZapReceipts(NOTE_ID, RELAYS)

      expect(result).toStrictEqual({
        data: [expect.objectContaining({ id: 'z'.repeat(64) })],
        error: 'noRelays',
        source: 'cache'
      })
    })
  })
})
