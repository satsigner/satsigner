import { isTabSegment } from '@/utils/tabSegment'

describe('isTabSegment', () => {
  it('accepts the bottom tab segments', () => {
    expect(isTabSegment('(signer)')).toBe(true)
    expect(isTabSegment('(explorer)')).toBe(true)
    expect(isTabSegment('(converter)')).toBe(true)
  })

  it('rejects other route segments', () => {
    expect(isTabSegment('(authenticated)')).toBe(false)
    expect(isTabSegment('(tabs)')).toBe(false)
    expect(isTabSegment('signer')).toBe(false)
    expect(isTabSegment('')).toBe(false)
  })

  it('finds the active tab in route segments', () => {
    const segments = ['(authenticated)', '(tabs)', '(explorer)', 'explorer']
    expect(segments.find(isTabSegment)).toBe('(explorer)')
    expect(['(authenticated)', 'settings'].find(isTabSegment)).toBeUndefined()
  })
})
