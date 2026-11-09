import { isFinalTransactionHex } from '@/utils/bitcoinContent'

describe('isFinalTransactionHex', () => {
  it('accepts a finalized transaction hex', () => {
    expect(isFinalTransactionHex('0200000001ABCD')).toBe(true)
  })

  it('rejects a partly signed PSBT in base64 or hex', () => {
    expect(isFinalTransactionHex('cHNidP8BAHECAAAAAQ==')).toBe(false)
    expect(isFinalTransactionHex('70736274ff0100')).toBe(false)
  })

  it('rejects empty and odd-length input', () => {
    expect(isFinalTransactionHex('')).toBe(false)
    expect(isFinalTransactionHex('abc')).toBe(false)
  })
})
