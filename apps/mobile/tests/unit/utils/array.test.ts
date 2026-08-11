import { groupBy } from '@/utils/array'

describe('groupBy', () => {
  it('returns an empty map for no items', () => {
    expect(groupBy([], (n: number) => n).size).toBe(0)
  })

  it('buckets items by the derived key', () => {
    const rows = [
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
      { id: 'a', v: 3 }
    ]
    const grouped = groupBy(rows, (row) => row.id)

    expect([...grouped.keys()]).toStrictEqual(['a', 'b'])
    expect(grouped.get('a')).toStrictEqual([
      { id: 'a', v: 1 },
      { id: 'a', v: 3 }
    ])
    expect(grouped.get('b')).toStrictEqual([{ id: 'b', v: 2 }])
  })

  it('preserves input order within each bucket', () => {
    const rows = [
      { id: 'tx', index: 0 },
      { id: 'tx', index: 1 },
      { id: 'tx', index: 2 }
    ]
    const grouped = groupBy(rows, (row) => row.id)

    expect(grouped.get('tx')?.map((r) => r.index)).toStrictEqual([0, 1, 2])
  })

  it('returns undefined for missing keys so callers can fall back', () => {
    const grouped = groupBy([{ id: 'a' }], (row) => row.id)
    expect(grouped.get('missing')).toBeUndefined()
  })
})
