import {
  detectTransactionSearchInput,
  isFinalTransactionHex
} from '@/utils/bitcoinContent'

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

describe('detectTransactionSearchInput', () => {
  const TXID = 'ab'.repeat(32)
  const RAW_TX = `02000000${'00'.repeat(60)}`

  it('treats 64 hex characters as a txid', () => {
    expect(detectTransactionSearchInput(TXID)).toBe('txid')
    expect(detectTransactionSearchInput(` ${TXID.toUpperCase()} `)).toBe('txid')
  })

  it('offers to broadcast longer even-length hex', () => {
    expect(detectTransactionSearchInput(RAW_TX)).toBe('rawTx')
  })

  it('never offers to broadcast a hex PSBT', () => {
    expect(
      detectTransactionSearchInput(`70736274ff${'00'.repeat(60)}`)
    ).toBeNull()
    expect(
      detectTransactionSearchInput(`70736274FF${'00'.repeat(60)}`)
    ).toBeNull()
  })

  it('ignores anything else', () => {
    expect(detectTransactionSearchInput('')).toBeNull()
    expect(detectTransactionSearchInput(`${RAW_TX}0`)).toBeNull()
    expect(detectTransactionSearchInput('ab'.repeat(20))).toBeNull()
    expect(detectTransactionSearchInput(`${TXID.slice(1)}z`)).toBeNull()
  })
})
