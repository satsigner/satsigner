import { bech32 } from 'bech32'

import { isLnurlWithdrawAmountInRange, resolveLnurlUrl } from '@/utils/lnurl'

function encodeLnurl(url: string): string {
  const words = bech32.toWords(Buffer.from(url, 'utf8'))
  return bech32.encode('lnurl', words, 1023)
}

describe('resolveLnurlUrl', () => {
  it('returns a plain URL unchanged', () => {
    expect(resolveLnurlUrl('https://service.example/withdraw?k1=abc')).toBe(
      'https://service.example/withdraw?k1=abc'
    )
  })

  it('strips the lightning: prefix', () => {
    expect(resolveLnurlUrl('lightning:https://service.example/w')).toBe(
      'https://service.example/w'
    )
  })

  it('decodes a bech32 LNURL', () => {
    const url = 'https://service.example/withdraw?k1=abc'
    expect(resolveLnurlUrl(encodeLnurl(url))).toBe(url)
  })

  it('decodes a bech32 LNURL behind a lightning: prefix', () => {
    const url = 'https://service.example/withdraw?k1=abc'
    expect(resolveLnurlUrl(`lightning:${encodeLnurl(url)}`)).toBe(url)
  })

  it('trims surrounding whitespace', () => {
    expect(resolveLnurlUrl('  https://service.example/w  ')).toBe(
      'https://service.example/w'
    )
  })
})

describe('isLnurlWithdrawAmountInRange', () => {
  const details = { maxWithdrawable: 5000, minWithdrawable: 2000 }

  it('accepts the exact minimum', () => {
    expect(isLnurlWithdrawAmountInRange(2, details)).toBe(true)
  })

  it('accepts the exact maximum', () => {
    expect(isLnurlWithdrawAmountInRange(5, details)).toBe(true)
  })

  it('rejects one sat below the minimum', () => {
    expect(isLnurlWithdrawAmountInRange(1, details)).toBe(false)
  })

  it('rejects one sat above the maximum', () => {
    expect(isLnurlWithdrawAmountInRange(6, details)).toBe(false)
  })

  it('rejects zero', () => {
    expect(isLnurlWithdrawAmountInRange(0, details)).toBe(false)
  })

  it('accepts a fixed-amount range', () => {
    const fixed = { maxWithdrawable: 3000, minWithdrawable: 3000 }
    expect(isLnurlWithdrawAmountInRange(3, fixed)).toBe(true)
    expect(isLnurlWithdrawAmountInRange(2, fixed)).toBe(false)
    expect(isLnurlWithdrawAmountInRange(4, fixed)).toBe(false)
  })
})
