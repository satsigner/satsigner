import { getDb } from '@/db/connection'
import { insertDms, replaceDm, updateDmStatus } from '@/db/mutations/nostr'
import { type NostrDM } from '@/types/models/Nostr'

import { mockQueryResult } from './queryResult'

const execute = jest.mocked(getDb().execute)

function dm(id: string): NostrDM {
  return {
    author: 'a'.repeat(64),
    created_at: 1_700_000_000,
    description: `message ${id}`,
    event: '',
    id,
    label: 1
  }
}

function executedSql(): string[] {
  return execute.mock.calls.map(([sql]) => sql.replaceAll(/\s+/g, ' ').trim())
}

describe('nostr DM mutations', () => {
  beforeEach(() => {
    // Migrations run on first getDb(); clear so assertions only see DM SQL.
    getDb()
    execute.mockClear()
    execute.mockReturnValue(mockQueryResult())
  })

  describe('insertDms', () => {
    it('appends DMs in one transaction without deleting existing ones', () => {
      insertDms('account-1', [dm('a'), dm('b')])

      const sql = executedSql()
      expect(sql[0]).toBe('BEGIN TRANSACTION')
      expect(sql.at(-1)).toBe('COMMIT')
      expect(
        sql.filter((s) => s.startsWith('INSERT OR IGNORE INTO nostr_dms'))
      ).toHaveLength(2)
      expect(sql.some((s) => s.startsWith('DELETE'))).toBe(false)
    })

    it('is idempotent: re-inserting the same DM is ignored by SQLite', () => {
      insertDms('account-1', [dm('a')])
      insertDms('account-1', [dm('a')])

      const inserts = execute.mock.calls.filter(([sql]) =>
        sql.includes('INSERT OR IGNORE INTO nostr_dms')
      )
      expect(inserts).toHaveLength(2)
      expect(inserts[0][1]).toStrictEqual(inserts[1][1])
    })

    it('does nothing for an empty list', () => {
      insertDms('account-1', [])

      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe('updateDmStatus', () => {
    it('updates only the given flags of one DM', () => {
      updateDmStatus('account-1', 'dm-1', { pending: false })

      expect(execute).toHaveBeenCalledWith(
        'UPDATE nostr_dms SET pending = ? WHERE account_id = ? AND id = ?',
        [0, 'account-1', 'dm-1']
      )
    })

    it('skips the query when nothing changes', () => {
      updateDmStatus('account-1', 'dm-1', {})

      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe('replaceDm', () => {
    it('swaps the optimistic row for the relay copy atomically', () => {
      replaceDm('account-1', 'pending-1', dm('real'))

      const sql = executedSql()
      expect(sql[0]).toBe('BEGIN TRANSACTION')
      expect(sql[1]).toBe(
        'DELETE FROM nostr_dms WHERE account_id = ? AND id = ?'
      )
      expect(sql[2]).toMatch(/^INSERT OR IGNORE INTO nostr_dms/)
      expect(sql[3]).toBe('COMMIT')
    })
  })
})
