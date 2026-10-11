import { getDb } from '@/db/connection'
import {
  getCacheCounts,
  getCachedEvent,
  getCachedProfile,
  getCachedZapsByPubkey,
  getNewestCachedTimestamp
} from '@/db/nostrCache'

import { mockQueryResult } from './queryResult'

const execute = jest.mocked(getDb().execute)

const EVENT_ROW = {
  cached_at: 1700000100,
  content: 'hello',
  created_at: 1700000000,
  event_id: 'event-1',
  is_own: 0,
  kind: 1,
  pubkey: 'pubkey-1',
  tags_json: JSON.stringify([['p', 'abc']])
}

function makeEventRow(overrides: Partial<typeof EVENT_ROW> = {}) {
  return { ...EVENT_ROW, ...overrides }
}

describe('nostr cache db', () => {
  beforeEach(() => {
    // Migrations run on first getDb(); clear so assertions only see cache SQL.
    getDb()
    execute.mockClear()
    execute.mockReturnValue(mockQueryResult())
  })

  describe('getCachedEvent', () => {
    it('maps the cached row and parses its tags', () => {
      execute.mockReturnValue(mockQueryResult([makeEventRow()]))

      expect(getCachedEvent('event-1')).toStrictEqual({
        content: 'hello',
        created_at: 1700000000,
        event_id: 'event-1',
        is_own: 0,
        kind: 1,
        pubkey: 'pubkey-1',
        tags: [['p', 'abc']]
      })
    })

    it('returns null when the event is not cached', () => {
      expect(getCachedEvent('missing')).toBeNull()
    })

    it('drops tags that are not lists of strings and keeps the rest', () => {
      execute.mockReturnValue(
        mockQueryResult([
          makeEventRow({ tags_json: '[["p", 1], null, ["e", "abc"]]' })
        ])
      )

      expect(getCachedEvent('event-1')?.tags).toStrictEqual([['e', 'abc']])
    })
  })

  describe('getCachedZapsByPubkey', () => {
    it('keeps matching receipts when another receipt has malformed tags', () => {
      execute.mockReturnValue(
        mockQueryResult([
          makeEventRow({
            event_id: 'zap-1',
            kind: 9735,
            tags_json: JSON.stringify([['p', 'ABC']])
          }),
          makeEventRow({
            event_id: 'zap-2',
            kind: 9735,
            tags_json: '[["p", 42]]'
          })
        ])
      )

      const zaps = getCachedZapsByPubkey('abc', 10)

      expect(zaps.map((zap) => zap.event_id)).toStrictEqual(['zap-1'])
    })
  })

  describe('getCachedProfile', () => {
    it('maps null columns to undefined fields', () => {
      execute.mockReturnValue(
        mockQueryResult([
          {
            banner: null,
            cached_at: 1700000100,
            created_at: 1700000000,
            display_name: 'Alice',
            event_id: null,
            lud16: null,
            nip05: null,
            picture: null,
            pubkey: 'pubkey-1'
          }
        ])
      )

      expect(getCachedProfile('PUBKEY-1')).toStrictEqual({
        banner: undefined,
        cached_at: 1700000100,
        created_at: 1700000000,
        displayName: 'Alice',
        event_id: undefined,
        lud16: undefined,
        nip05: undefined,
        picture: undefined,
        pubkey: 'pubkey-1'
      })
    })

    it('returns null when the profile is not cached', () => {
      expect(getCachedProfile('pubkey-1')).toBeNull()
    })
  })

  describe('getNewestCachedTimestamp', () => {
    it('returns the newest cached timestamp', () => {
      execute.mockReturnValue(mockQueryResult([{ max_ts: 1700000000 }]))

      expect(getNewestCachedTimestamp(1)).toBe(1700000000)
    })

    it('returns null when nothing of that kind is cached', () => {
      execute.mockReturnValue(mockQueryResult([{ max_ts: null }]))

      expect(getNewestCachedTimestamp(1, 'pubkey-1')).toBeNull()
    })
  })

  describe('getCacheCounts', () => {
    it('reads each count and treats a missing row as 0', () => {
      execute
        .mockReturnValueOnce(mockQueryResult([{ cnt: 3 }]))
        .mockReturnValueOnce(mockQueryResult([{ cnt: 1 }]))
        .mockReturnValueOnce(mockQueryResult([{ cnt: 5 }]))
        .mockReturnValueOnce(mockQueryResult([{ cnt: 2 }]))

      expect(getCacheCounts('PUBKEY-1')).toStrictEqual({
        feedNotes: 5,
        ownNotes: 3,
        ownZaps: 1,
        profiles: 0,
        zapReceipts: 2
      })
    })
  })
})
