import { t } from '@/locales'
import {
  getTabSegmentLabel,
  isTabSegment,
  toTabSegment
} from '@/utils/tabSegment'

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

describe('toTabSegment', () => {
  it('keeps a bottom tab segment', () => {
    expect(toTabSegment('(explorer)')).toBe('(explorer)')
    expect(toTabSegment('(converter)')).toBe('(converter)')
  })

  it('falls back to the signer tab', () => {
    expect(toTabSegment(undefined)).toBe('(signer)')
    expect(toTabSegment('')).toBe('(signer)')
    expect(toTabSegment('(tabs)')).toBe('(signer)')
  })
})

describe('getTabSegmentLabel', () => {
  it('returns the navigation label of each tab', () => {
    expect(getTabSegmentLabel('(signer)')).toBe(t('navigation.label.signer'))
    expect(getTabSegmentLabel('(explorer)')).toBe(
      t('navigation.label.explorer')
    )
    expect(getTabSegmentLabel('(converter)')).toBe(
      t('navigation.label.converter')
    )
  })
})
