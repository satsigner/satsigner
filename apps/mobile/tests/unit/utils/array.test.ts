import { groupBy, isNumberArray, isStringArray } from '@/utils/array'

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

describe('isNumberArray', () => {
  it('accepts arrays of numbers, including empty arrays', () => {
    expect(isNumberArray([])).toBe(true)
    expect(isNumberArray([0, 20, 255])).toBe(true)
  })

  it('rejects arrays with a non-number item', () => {
    expect(isNumberArray([1, '2'])).toBe(false)
    expect(isNumberArray([1, null])).toBe(false)
    expect(isNumberArray([[1]])).toBe(false)
  })

  it('rejects non-arrays', () => {
    expect(isNumberArray({ 0: 1, length: 1 })).toBe(false)
    expect(isNumberArray('0102')).toBe(false)
    expect(isNumberArray(null)).toBe(false)
    expect(isNumberArray(undefined)).toBe(false)
  })
})

describe('isStringArray', () => {
  it('accepts arrays of strings, including empty arrays', () => {
    expect(isStringArray([])).toBe(true)
    expect(isStringArray(['e', 'abc'])).toBe(true)
  })

  it('rejects arrays with a non-string item', () => {
    expect(isStringArray(['e', 1])).toBe(false)
    expect(isStringArray(['e', undefined])).toBe(false)
    expect(isStringArray([['e']])).toBe(false)
  })

  it('rejects non-arrays', () => {
    expect(isStringArray({ 0: 'e' })).toBe(false)
    expect(isStringArray('e')).toBe(false)
    expect(isStringArray(null)).toBe(false)
  })
})
