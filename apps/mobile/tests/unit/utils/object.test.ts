import { isRecord } from '@/utils/object'

describe('isRecord', () => {
  it('accepts plain objects', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ key: 'value' })).toBe(true)
  })

  it('rejects arrays', () => {
    expect(isRecord([])).toBe(false)
    expect(isRecord([{ key: 'value' }])).toBe(false)
  })

  it('rejects null and primitives', () => {
    expect(isRecord(null)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
    expect(isRecord('text')).toBe(false)
    expect(isRecord(1)).toBe(false)
    expect(isRecord(true)).toBe(false)
  })
})
