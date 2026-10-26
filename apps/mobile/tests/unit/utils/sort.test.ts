import { type Transaction } from '@/types/models/Transaction'
import { compareAmount, compareTimestamp, sortTransactions } from '@/utils/sort'

function makeTx(
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>
): Transaction {
  return {
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    type: 'receive',
    vin: [],
    vout: [],
    ...overrides
  }
}

describe('sort utils', () => {
  describe('compareTimestamp', () => {
    it('should return correct timestamp sort order', () => {
      const date1 = new Date('January 03, 2009')
      const date2 = new Date('January 04, 2009')

      expect(compareTimestamp(date1, date2)).toBeLessThan(0)
      expect(compareTimestamp(date1, date1)).toBe(0)
      expect(compareTimestamp(date2, date1)).toBeGreaterThan(0)

      const date3 = '2024-05-30T13:38:59.281Z'
      const date4 = '2024-05-31T13:38:59.281Z'

      expect(compareTimestamp(date3, date4)).toBeLessThan(0)
      expect(compareTimestamp(date3, date3)).toBe(0)
      expect(compareTimestamp(date4, date3)).toBeGreaterThan(0)
    })
  })

  describe('compareAmount', () => {
    it('should return correct amount sort order', () => {
      const amount1 = 21
      const amount2 = 21_000_000

      expect(compareAmount(amount1, amount2)).toBeLessThan(0)
      expect(compareAmount(amount1, amount1)).toBe(0)
      expect(compareAmount(amount2, amount1)).toBeGreaterThan(0)
    })
  })

  describe('sortTransactions', () => {
    const txs = [
      makeTx({
        id: 'old',
        label: 'zeta',
        received: 100,
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        type: 'receive'
      }),
      makeTx({
        id: 'new',
        label: 'alpha',
        received: 500,
        timestamp: new Date('2026-03-01T00:00:00.000Z'),
        type: 'receive'
      }),
      makeTx({
        id: 'mid',
        label: 'beta',
        received: 0,
        sent: 250,
        timestamp: new Date('2026-02-01T00:00:00.000Z'),
        type: 'send'
      }),
      makeTx({
        id: 'mempool',
        label: '',
        received: 50,
        type: 'receive'
      })
    ]

    it('sorts by date newest first on desc', () => {
      const sorted = sortTransactions(txs, 'desc', 'date')
      expect(sorted.map((tx) => tx.id)).toStrictEqual([
        'mempool',
        'new',
        'mid',
        'old'
      ])
    })

    it('sorts by date oldest first on asc', () => {
      const sorted = sortTransactions(txs, 'asc', 'date')
      expect(sorted.map((tx) => tx.id)).toStrictEqual([
        'old',
        'mid',
        'new',
        'mempool'
      ])
    })

    it('keeps a same-block parent before the child that spends it', () => {
      const blockTime = new Date('2026-04-01T00:00:00.000Z')
      const parent = makeTx({ id: 'ffff-parent', timestamp: blockTime })
      const child = makeTx({
        id: 'aaaa-child',
        timestamp: blockTime,
        vin: [
          {
            previousOutput: { txid: 'ffff-parent', vout: 1 },
            scriptSig: '',
            sequence: 0,
            witness: []
          }
        ]
      })

      const ascending = sortTransactions([child, parent], 'asc', 'date')
      const descending = sortTransactions([parent, child], 'desc', 'date')

      expect(ascending.map((tx) => tx.id)).toStrictEqual([
        'ffff-parent',
        'aaaa-child'
      ])
      expect(descending.map((tx) => tx.id)).toStrictEqual([
        'aaaa-child',
        'ffff-parent'
      ])
    })

    it('orders same-time transactions the same way in both directions', () => {
      const blockTime = new Date('2026-04-01T00:00:00.000Z')
      const first = makeTx({ id: 'b', timestamp: blockTime })
      const second = makeTx({ id: 'a', timestamp: blockTime })

      const ascending = sortTransactions([first, second], 'asc', 'date')
      const descending = sortTransactions([first, second], 'desc', 'date')

      expect(descending.map((tx) => tx.id)).toStrictEqual(
        ascending.map((tx) => tx.id).toReversed()
      )
    })

    it('sorts by amount', () => {
      const sorted = sortTransactions(txs, 'desc', 'amount')
      expect(sorted.map((tx) => tx.id)).toStrictEqual([
        'new',
        'mid',
        'old',
        'mempool'
      ])
    })

    it('sorts by label', () => {
      const sorted = sortTransactions(txs, 'asc', 'label')
      expect(sorted.map((tx) => tx.id)).toStrictEqual([
        'new',
        'mid',
        'old',
        'mempool'
      ])
    })
  })
})
