import { normalizePsbtToBase64 } from '@/utils/psbt'

describe('normalizePsbtToBase64', () => {
  const PSBT_MAGIC_HEX = '70736274ff'
  const PSBT_MAGIC_BASE64 = 'cHNidP'

  it('converts hex PSBT with magic prefix to base64', () => {
    const hexPsbt = `${PSBT_MAGIC_HEX}01000000`
    const result = normalizePsbtToBase64(hexPsbt)
    expect(result).toBe(Buffer.from(hexPsbt, 'hex').toString('base64'))
  })

  it('converts uppercase hex PSBT with magic prefix to base64', () => {
    const hexPsbt = `${PSBT_MAGIC_HEX.toUpperCase()}01000000`
    const result = normalizePsbtToBase64(hexPsbt)
    expect(result).toBe(Buffer.from(hexPsbt, 'hex').toString('base64'))
  })

  it('returns base64 PSBT as-is', () => {
    const base64Psbt = `${PSBT_MAGIC_BASE64}AAAAAAAAAA==`
    const result = normalizePsbtToBase64(base64Psbt)
    expect(result).toBe(base64Psbt)
  })

  it('converts generic long hex string to base64', () => {
    const longHex = 'ab'.repeat(60)
    const result = normalizePsbtToBase64(longHex)
    expect(result).toBe(Buffer.from(longHex, 'hex').toString('base64'))
  })

  it('returns short hex string as-is', () => {
    const shortHex = 'abcdef'
    const result = normalizePsbtToBase64(shortHex)
    expect(result).toBe(shortHex)
  })

  it('returns non-hex string as-is', () => {
    const notHex = 'not-a-hex-string-with-dashes-and-stuff-that-is-long-enough'
    const result = normalizePsbtToBase64(notHex)
    expect(result).toBe(notHex)
  })
})
