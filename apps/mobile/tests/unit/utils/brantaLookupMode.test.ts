import { normalizeBrantaLookupMode } from '@/utils/brantaLookupMode'

describe('normalizeBrantaLookupMode', () => {
  it('keeps a known mode', () => {
    expect(normalizeBrantaLookupMode('always')).toBe('always')
    expect(normalizeBrantaLookupMode('manual')).toBe('manual')
    expect(normalizeBrantaLookupMode('off')).toBe('off')
  })

  it('turns lookups off for an unknown stored mode', () => {
    expect(normalizeBrantaLookupMode('ask')).toBe('off')
    expect(normalizeBrantaLookupMode(true)).toBe('off')
    expect(normalizeBrantaLookupMode(undefined)).toBe('off')
  })
})
