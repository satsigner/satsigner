import { getDb } from '@/db/connection'
import {
  cacheEvents,
  cacheProfile,
  clearIdentityCache,
  deleteCachedEventsByAuthor,
  getCacheCounts,
  getCachedEvent,
  getCachedProfile,
  getCachedZapReceipts,
  getCachedZapsByPubkey,
  getNewestCachedTimestamp,
  getNewestCachedZapTimestamp
} from '@/db/nostrCache'

import { mockQueryResult } from './queryResult'

const execute = jest.mocked(getDb().execute)

const EVENT_ROW = {
  cached_at: 1_700_000_100,
  content: 'hello',
  created_at: 1_700_000_000,
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
        created_at: 1_700_000_000,
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
    it('looks receipts up by target_pubkey in SQL with a LIMIT', () => {
      execute.mockReturnValue(
        mockQueryResult([makeEventRow({ event_id: 'zap-1', kind: 9735 })])
      )

      const zaps = getCachedZapsByPubkey('ABC', 10)

      expect(zaps.map((zap) => zap.event_id)).toStrictEqual(['zap-1'])
      const [[sql, params]] = execute.mock.calls
      expect(sql).toMatch(/kind = \? AND target_pubkey = \?/)
      expect(sql).toMatch(/ORDER BY created_at DESC LIMIT \?/)
      expect(params).toStrictEqual([9735, 'abc', 10])
    })

    it('pages with until', () => {
      getCachedZapsByPubkey('abc', 5, 1_700_000_000)

      const [[sql, params]] = execute.mock.calls
      expect(sql).toMatch(/created_at < \?/)
      expect(params).toStrictEqual([9735, 'abc', 1_700_000_000, 5])
    })
  })

  describe('getNewestCachedZapTimestamp', () => {
    it('is scoped to the zapped pubkey', () => {
      execute.mockReturnValue(mockQueryResult([{ max_ts: 1_700_000_500 }]))

      expect(getNewestCachedZapTimestamp('ABC')).toBe(1_700_000_500)
      const [[sql, params]] = execute.mock.calls
      expect(sql).toMatch(/target_pubkey = \?/)
      expect(params).toStrictEqual([9735, 'abc'])
    })
  })

  describe('getCachedZapReceipts', () => {
    it('always applies a LIMIT and keeps only receipts for the note', () => {
      const noteId = 'f'.repeat(64)
      execute.mockReturnValue(
        mockQueryResult([
          makeEventRow({
            event_id: 'zap-1',
            kind: 9735,
            tags_json: JSON.stringify([['e', noteId]])
          }),
          makeEventRow({
            event_id: 'zap-2',
            kind: 9735,
            tags_json: JSON.stringify([['p', noteId]])
          })
        ])
      )

      const zaps = getCachedZapReceipts(noteId, 25)

      expect(zaps.map((zap) => zap.event_id)).toStrictEqual(['zap-1'])
      const [[sql, params]] = execute.mock.calls
      expect(sql).toMatch(/LIMIT \?/)
      expect(params?.at(-1)).toBe(25)
    })

    it('rejects ids that are not hex', () => {
      expect(getCachedZapReceipts("x' OR 1=1 --", 25)).toStrictEqual([])
      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe('cacheEvents', () => {
    function insertedParams() {
      return execute.mock.calls
        .filter(([sql]) =>
          sql.includes('INSERT OR REPLACE INTO nostr_event_cache')
        )
        .map(([, params]) => params)
    }

    it('stores the zapped pubkey (p tag) and marks zaps to own pubkeys as own', () => {
      cacheEvents(
        [
          {
            content: '',
            created_at: 10,
            id: 'zap-1',
            kind: 9735,
            pubkey: 'lnurl-server',
            tags: [['p', 'OWN']]
          },
          {
            content: 'hi',
            created_at: 11,
            id: 'note-1',
            kind: 1,
            pubkey: 'someone',
            tags: [['p', 'own']]
          }
        ],
        ['own']
      )

      const [zapParams, noteParams] = insertedParams()
      expect(zapParams?.slice(-2)).toStrictEqual([1, 'own'])
      expect(noteParams?.slice(-2)).toStrictEqual([0, null])
    })
  })

  describe('cacheProfile', () => {
    it('only replaces a cached profile with a newer one', () => {
      cacheProfile('PUBKEY', { displayName: 'Alice' }, 'ev-1', 200)

      const [[sql, params]] = execute.mock.calls
      expect(sql).toMatch(/ON CONFLICT\(pubkey\) DO UPDATE/)
      expect(sql).toMatch(
        /WHERE excluded\.created_at >= nostr_profile_cache\.created_at/
      )
      expect(params?.[0]).toBe('pubkey')
      expect(params?.[7]).toBe(200)
    })
  })

  describe('deleteCachedEventsByAuthor', () => {
    it('only deletes events signed by the author', () => {
      deleteCachedEventsByAuthor(['note-1', 'note-2'], 'AUTHOR')

      const [[sql, params]] = execute.mock.calls
      expect(sql).toMatch(/WHERE pubkey = \? AND event_id IN \(\?,\?\)/)
      expect(params).toStrictEqual(['author', 'note-1', 'note-2'])
    })
  })

  describe('clearIdentityCache', () => {
    it('removes the identity notes, received zaps and profile', () => {
      clearIdentityCache('ABC')

      expect(
        execute.mock.calls.map(([sql, params]) => [sql, params])
      ).toStrictEqual([
        [
          'DELETE FROM nostr_event_cache WHERE pubkey = ? OR target_pubkey = ?',
          ['abc', 'abc']
        ],
        ['DELETE FROM nostr_profile_cache WHERE pubkey = ?', ['abc']]
      ])
    })
  })

  describe('getCachedProfile', () => {
    it('maps null columns to undefined fields', () => {
      execute.mockReturnValue(
        mockQueryResult([
          {
            banner: null,
            cached_at: 1_700_000_100,
            created_at: 1_700_000_000,
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
        cached_at: 1_700_000_100,
        created_at: 1_700_000_000,
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
      execute.mockReturnValue(mockQueryResult([{ max_ts: 1_700_000_000 }]))

      expect(getNewestCachedTimestamp(1)).toBe(1_700_000_000)
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
