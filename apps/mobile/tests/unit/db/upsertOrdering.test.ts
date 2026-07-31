import { type NitroSQLiteConnection } from 'react-native-nitro-sqlite'

import { upsertTransactions } from '@/db/mutations/transactions'
import { type Transaction } from '@/types/models/Transaction'

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

function buildTransaction(id: string): Transaction {
  return {
    id,
    label: '',
    lockTimeEnabled: false,
    prices: {},
    received: 100,
    sent: 0,
    type: 'receive',
    vin: [
      {
        previousOutput: { txid: 'prev', vout: 0 },
        scriptSig: [],
        sequence: 0,
        witness: []
      }
    ],
    vout: [{ address: 'addr', script: [], value: 100 }]
  } as unknown as Transaction
}

function firstIndexMatching(calls: Call[], pattern: RegExp): number {
  return calls.findIndex((call) => pattern.test(call.sql))
}

describe('upsertTransactions statement ordering', () => {
  it('writes the parent transaction row before any child rows', () => {
    const { calls, tx } = createFakeTx()
    upsertTransactions(tx, 'acct', [buildTransaction('t1')])

    const parentInsert = firstIndexMatching(
      calls,
      /INSERT OR REPLACE INTO transactions/
    )
    const inputInsert = firstIndexMatching(calls, /INSERT INTO tx_inputs/)
    const outputInsert = firstIndexMatching(calls, /INSERT INTO tx_outputs/)

    expect(parentInsert).toBeGreaterThanOrEqual(0)
    expect(inputInsert).toBeGreaterThan(parentInsert)
    expect(outputInsert).toBeGreaterThan(parentInsert)
  })

  /**
   * `INSERT OR REPLACE` on transactions deletes the row, and tx_inputs /
   * tx_outputs cascade on that delete. Child inserts must therefore come after
   * the parent insert, otherwise every vin/vout is silently wiped.
   */
  it('clears child rows after the parent write and before child inserts', () => {
    const { calls, tx } = createFakeTx()
    upsertTransactions(tx, 'acct', [buildTransaction('t1')])

    const parentInsert = firstIndexMatching(
      calls,
      /INSERT OR REPLACE INTO transactions/
    )
    const inputDelete = firstIndexMatching(calls, /DELETE FROM tx_inputs/)
    const outputDelete = firstIndexMatching(calls, /DELETE FROM tx_outputs/)
    const inputInsert = firstIndexMatching(calls, /INSERT INTO tx_inputs/)
    const outputInsert = firstIndexMatching(calls, /INSERT INTO tx_outputs/)

    expect(inputDelete).toBeGreaterThan(parentInsert)
    expect(outputDelete).toBeGreaterThan(parentInsert)
    expect(inputInsert).toBeGreaterThan(inputDelete)
    expect(outputInsert).toBeGreaterThan(outputDelete)
  })

  it('batches many transactions into single multi-row inserts', () => {
    const { calls, tx } = createFakeTx()
    const transactions = Array.from({ length: 20 }, (_, i) =>
      buildTransaction(`t${i}`)
    )
    upsertTransactions(tx, 'acct', transactions)

    const parentInserts = calls.filter((c) =>
      /INSERT OR REPLACE INTO transactions/.test(c.sql)
    )
    const inputInserts = calls.filter((c) =>
      /INSERT INTO tx_inputs/.test(c.sql)
    )

    expect(parentInserts).toHaveLength(1)
    expect(inputInserts).toHaveLength(1)
    expect(parentInserts[0].params).toHaveLength(20 * 18)
  })

  /**
   * tx_inputs / tx_outputs use a bare INSERT under
   * UNIQUE (tx_id, account_id, index). Batching puts every child row in one
   * statement, so a repeated id would abort the whole transaction. The previous
   * row-by-row code tolerated duplicates by letting the later one win.
   */
  it('keeps the last entry when a transaction id repeats', () => {
    const { calls, tx } = createFakeTx()
    const first = buildTransaction('dup')
    const second = { ...buildTransaction('dup'), label: 'winner' }
    upsertTransactions(tx, 'acct', [first, second])

    const parentInsert = calls.find((c) =>
      /INSERT OR REPLACE INTO transactions/.test(c.sql)
    )
    const inputInsert = calls.find((c) => /INSERT INTO tx_inputs/.test(c.sql))

    expect(parentInsert?.params).toHaveLength(18)
    expect(parentInsert?.params).toContain('winner')
    expect(inputInsert?.params).toHaveLength(10)
  })

  it('emits nothing for an empty transaction list', () => {
    const { calls, tx } = createFakeTx()
    upsertTransactions(tx, 'acct', [])
    expect(calls).toHaveLength(0)
  })
})
