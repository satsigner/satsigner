import { type NitroSQLiteConnection } from 'react-native-nitro-sqlite'

import { bulkInsert } from '@/db/bulkInsert'

const MAX_SQL_VARIABLES = 32766

type Call = { sql: string; params: unknown[] }

function createFakeTx() {
  const calls: Call[] = []
  const tx = {
    execute: (sql: string, params?: unknown[]) => {
      calls.push({ params: params ?? [], sql })
      return { rows: [], rowsAffected: 0 }
    }
  } as unknown as NitroSQLiteConnection
  return { calls, tx }
}

describe('bulkInsert', () => {
  it('does nothing when there are no rows', () => {
    const { calls, tx } = createFakeTx()
    bulkInsert(tx, 'INSERT INTO t (a, b)', 2, [])
    expect(calls).toHaveLength(0)
  })

  it('emits one multi-row statement with flattened params', () => {
    const { calls, tx } = createFakeTx()
    bulkInsert(tx, 'INSERT INTO t (a, b)', 2, [
      [1, 'x'],
      [2, 'y'],
      [3, 'z']
    ])

    expect(calls).toHaveLength(1)
    expect(calls[0].sql).toBe(
      'INSERT INTO t (a, b) VALUES (?, ?), (?, ?), (?, ?)'
    )
    expect(calls[0].params).toStrictEqual([1, 'x', 2, 'y', 3, 'z'])
  })

  it('keeps placeholder count equal to the params count', () => {
    const { calls, tx } = createFakeTx()
    const rows = Array.from({ length: 50 }, (_, i) => [i, `v${i}`, null])
    bulkInsert(tx, 'INSERT INTO t (a, b, c)', 3, rows)

    for (const call of calls) {
      const placeholders = (call.sql.match(/\?/g) ?? []).length
      expect(placeholders).toBe(call.params.length)
    }
  })

  it('chunks so no statement exceeds the SQLite variable limit', () => {
    const { calls, tx } = createFakeTx()
    const columnCount = 18
    const rowCount = 5000
    const rows = Array.from({ length: rowCount }, () =>
      Array.from({ length: columnCount }, () => 1)
    )

    bulkInsert(tx, 'INSERT INTO t (c)', columnCount, rows)

    expect(calls.length).toBeGreaterThan(1)
    for (const call of calls) {
      expect(call.params.length).toBeLessThanOrEqual(MAX_SQL_VARIABLES)
    }

    const totalParams = calls.reduce((sum, c) => sum + c.params.length, 0)
    expect(totalParams).toBe(rowCount * columnCount)
  })

  it('preserves row order and values across chunk boundaries', () => {
    const { calls, tx } = createFakeTx()
    const columnCount = 2
    const rowsPerChunk = Math.floor(MAX_SQL_VARIABLES / columnCount)
    const rowCount = rowsPerChunk + 10
    const rows = Array.from({ length: rowCount }, (_, i) => [i, `v${i}`])

    bulkInsert(tx, 'INSERT INTO t (a, b)', columnCount, rows)

    expect(calls).toHaveLength(2)
    const flattened = calls.flatMap((c) => c.params)
    expect(flattened).toStrictEqual(rows.flat())
  })

  it('handles a column count larger than the variable limit per row', () => {
    const { calls, tx } = createFakeTx()
    const columnCount = MAX_SQL_VARIABLES + 5
    const rows = [Array.from({ length: columnCount }, () => 0)]

    bulkInsert(tx, 'INSERT INTO t (c)', columnCount, rows)

    expect(calls).toHaveLength(1)
    expect(calls[0].params).toHaveLength(columnCount)
  })
})
