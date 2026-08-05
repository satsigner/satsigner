import { normalizePsbtToBase64 } from '@/utils/psbtTransport'

const SAMPLE_BASE64 =
  'cHNidP8BAHECAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP////8AAAAA'

describe('normalizePsbtToBase64', () => {
  it('returns base64 PSBT unchanged', () => {
    expect(normalizePsbtToBase64(`  ${SAMPLE_BASE64}  `)).toBe(SAMPLE_BASE64)
  })

  it('converts hex PSBT to base64', () => {
    const hex = Buffer.from(SAMPLE_BASE64, 'base64').toString('hex')
    expect(normalizePsbtToBase64(hex)).toBe(SAMPLE_BASE64)
  })

  it('rejects non-PSBT input', () => {
    expect(normalizePsbtToBase64('not-a-psbt')).toBeNull()
    expect(normalizePsbtToBase64('')).toBeNull()
  })
})
