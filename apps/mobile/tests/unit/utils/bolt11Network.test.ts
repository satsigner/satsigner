import { getBolt11Network } from '@/utils/bolt11Network'

describe('getBolt11Network', () => {
  it('detects mainnet from lnbc prefix', () => {
    expect(getBolt11Network('lnbc1u1pvjluezpp5...')).toBe('bitcoin')
  })

  it('detects testnet from lntb prefix', () => {
    expect(getBolt11Network('lntb1u1p...')).toBe('testnet')
  })

  it('detects signet from lntbs prefix', () => {
    expect(getBolt11Network('lntbs100n1p...')).toBe('signet')
  })

  it('returns null for regtest invoices', () => {
    expect(getBolt11Network('lnbcrt100n1p...')).toBeNull()
  })

  it('returns null for non-bolt11 strings', () => {
    expect(getBolt11Network('not-an-invoice')).toBeNull()
    expect(getBolt11Network('')).toBeNull()
  })

  it('handles uppercase invoices', () => {
    expect(getBolt11Network('LNBC1U1PVJLUEZ')).toBe('bitcoin')
  })

  it('trims whitespace', () => {
    expect(getBolt11Network('  lnbc1u1p  ')).toBe('bitcoin')
  })
})
