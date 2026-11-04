import { scannedPayload } from '@/utils/qrScan'

describe('scannedPayload', () => {
  it('prefers data, falls back to raw, and ignores empty codes', () => {
    expect(scannedPayload({ data: 'ur:psbt/1-3/abc', raw: 'raw' })).toBe(
      'ur:psbt/1-3/abc'
    )
    expect(scannedPayload({ data: '', raw: 'bitcoin:bc1q' })).toBe(
      'bitcoin:bc1q'
    )
    expect(scannedPayload({ data: null })).toBeNull()
    expect(scannedPayload(undefined)).toBeNull()
  })
})
