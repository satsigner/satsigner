import { tabIndicatorOffset, tabSegmentIndex } from '@/utils/tabBarIndicator'

describe('tabSegmentIndex', () => {
  it('maps each tab in bar order', () => {
    expect(tabSegmentIndex('(explorer)')).toBe(0)
    expect(tabSegmentIndex('(signer)')).toBe(1)
    expect(tabSegmentIndex('(converter)')).toBe(2)
  })

  it('falls back to the default tab when the segment is missing', () => {
    expect(tabSegmentIndex(undefined)).toBe(1)
  })
})

describe('tabIndicatorOffset', () => {
  it('centers the capsule in the active slot', () => {
    expect(tabIndicatorOffset(0, 390)).toBe(15)
    expect(tabIndicatorOffset(1, 390)).toBe(145)
    expect(tabIndicatorOffset(2, 390)).toBe(275)
  })

  it('stays put until the bar has been measured', () => {
    expect(tabIndicatorOffset(1, 0)).toBe(0)
  })
})
