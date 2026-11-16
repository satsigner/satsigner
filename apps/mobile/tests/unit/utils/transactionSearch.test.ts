import type { Transaction } from '@/types/models/Transaction'
import { formatDate } from '@/utils/format'
import {
  dateToDayIndex,
  describeActiveFilters,
  dayIndexToDate,
  filterTransactions,
  getTransactionDateBounds,
  getTransactionTags,
  toggleTag
} from '@/utils/transactionSearch'

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx',
    label: '',
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

const coffee = makeTx({
  id: 'aaa111',
  label: 'coffee ☕ #food',
  timestamp: new Date(2026, 0, 10, 9)
})
const dinner = makeTx({
  id: 'bbb222',
  label: 'Dinner split #food #friends',
  timestamp: new Date(2026, 1, 3, 20)
})
const selfSend = makeTx({
  id: 'ccc333',
  label: 'test tx #selfsend',
  timestamp: new Date(2026, 2, 15, 12),
  type: 'send'
})
const pending = makeTx({ id: 'ddd444', label: 'coffee again' })

const transactions = [coffee, dinner, selfSend, pending]
const noFilters = { query: '', tags: [] }

function ids(result: Transaction[]) {
  return result.map(({ id }) => id)
}

describe('getTransactionTags', () => {
  it('lists every tag once, sorted', () => {
    expect(getTransactionTags(transactions)).toStrictEqual([
      'food',
      'friends',
      'selfsend'
    ])
  })
})

describe('filterTransactions', () => {
  it('returns everything, newest first, without filters', () => {
    expect(ids(filterTransactions(transactions, noFilters))).toStrictEqual([
      'ccc333',
      'bbb222',
      'aaa111',
      'ddd444'
    ])
  })

  it('matches label text case-insensitively, ignoring tags', () => {
    const result = filterTransactions(transactions, {
      ...noFilters,
      query: 'COFFEE'
    })
    expect(ids(result)).toStrictEqual(['aaa111', 'ddd444'])
    expect(
      filterTransactions(transactions, { ...noFilters, query: 'friends' })
    ).toStrictEqual([])
  })

  it('matches txids', () => {
    const result = filterTransactions(transactions, {
      ...noFilters,
      query: 'bbb2'
    })
    expect(ids(result)).toStrictEqual(['bbb222'])
  })

  it('filters by direction', () => {
    const sent = filterTransactions(transactions, {
      ...noFilters,
      direction: 'send'
    })
    const received = filterTransactions(transactions, {
      ...noFilters,
      direction: 'receive'
    })
    expect(ids(sent)).toStrictEqual(['ccc333'])
    expect(ids(received)).toStrictEqual(['bbb222', 'aaa111', 'ddd444'])
  })

  it('requires every selected tag', () => {
    const result = filterTransactions(transactions, {
      ...noFilters,
      tags: ['food', 'friends']
    })
    expect(ids(result)).toStrictEqual(['bbb222'])
  })

  it('keeps whole days at both ends of the date range', () => {
    const result = filterTransactions(transactions, {
      ...noFilters,
      from: new Date(2026, 0, 10, 23),
      to: new Date(2026, 1, 3, 0)
    })
    expect(ids(result)).toStrictEqual(['bbb222', 'aaa111'])
  })

  it('drops unconfirmed transactions once a date is set', () => {
    const result = filterTransactions(transactions, {
      ...noFilters,
      from: new Date(2020, 0, 1)
    })
    expect(ids(result)).not.toContain('ddd444')
  })
})

describe('automatic tags in search', () => {
  const automaticTags = new Map([['aaa111', ['rbf']]])

  it('lists computed tags next to label tags', () => {
    expect(getTransactionTags(transactions, automaticTags)).toContain('rbf')
  })

  it('filters by computed tags', () => {
    const result = filterTransactions(
      transactions,
      { ...noFilters, tags: ['rbf'] },
      automaticTags
    )
    expect(ids(result)).toStrictEqual(['aaa111'])
  })
})

describe('toggleTag', () => {
  it('adds and removes a tag', () => {
    expect(toggleTag(['food'], 'friends')).toStrictEqual(['food', 'friends'])
    expect(toggleTag(['food', 'friends'], 'food')).toStrictEqual(['friends'])
  })
})

describe('getTransactionDateBounds', () => {
  it('spans the first to the last confirmed transaction day', () => {
    const bounds = getTransactionDateBounds(transactions)
    expect(bounds?.first).toStrictEqual(new Date(2026, 0, 10))
    expect(bounds?.dayCount).toBe(64)
  })

  it('is undefined without confirmed transactions', () => {
    expect(getTransactionDateBounds([pending])).toBeUndefined()
  })
})

describe('day index conversion', () => {
  it('round-trips between dates and day indexes', () => {
    const first = new Date(2026, 0, 10)
    expect(dayIndexToDate(first, 24)).toStrictEqual(new Date(2026, 1, 3))
    expect(dateToDayIndex(first, new Date(2026, 1, 3, 20))).toBe(24)
  })
})

describe('describeActiveFilters', () => {
  it('is empty without filters', () => {
    expect(describeActiveFilters(noFilters)).toStrictEqual([])
  })

  it('lists direction, query, tags and dates in order', () => {
    const from = new Date(2026, 0, 10)
    expect(
      describeActiveFilters({
        direction: 'send',
        from,
        query: '  coffee ',
        tags: ['food', 'selfsend']
      })
    ).toStrictEqual([
      'Sent',
      '"coffee"',
      '#food',
      '#selfsend',
      `${formatDate(from)} - Any`
    ])
  })
})
