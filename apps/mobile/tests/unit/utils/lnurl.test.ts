import { bech32 } from 'bech32'

import {
  isLnurlWithdrawAmountInRange,
  requestLNURLPayInvoice,
  resolveLnurlUrl
} from '@/utils/lnurl'

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

  it('rejects cleartext http LNURLs', () => {
    expect(() =>
      resolveLnurlUrl(encodeLnurl('http://service.example/withdraw'))
    ).toThrow(/HTTPS/)
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

// Synthetic bolt11 invoices (signature is not verified by the decoder):
// - 1,000 sats   (lnbc10u, 1_000_000 msat)
// - 100,000 sats (lnbc1m, 100_000_000 msat)
// - amountless
const INVOICE_1000_SATS =
  'lnbc10u1pjeyqyqpp5qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qursdqudahx2gr5dphh2umpdejzqumpw3essp5pyysjzgfpyysjzgfpyysjzgfpyysjzgfpyysjzgfpyysjzgfpyyscqrqqjqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpwuejmr'
const INVOICE_100000_SATS =
  'lnbc1m1pjeyqyqpp5qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qursdpgdahx2grgw4hxgun9vss8g6r0w4ekzmnyypekzarnsp5pyysjzgfpyysjzgfpyysjzgfpyysjzgfpyysjzgfpyysjzgfpyyscqrqqjqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgppw8uj0'
const INVOICE_AMOUNTLESS =
  'lnbc1pjeyqyqpp5qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qursdqsv9kk7atww3kx2umnsp5pyysjzgfpyysjzgfpyysjzgfpyysjzgfpyysjzgfpyysjzgfpyyscqrqqjqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpnlmy36'

function mockInvoiceResponse(pr: string) {
  const fetchMock = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ pr }),
    ok: true
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

describe('requestLNURLPayInvoice amount verification', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns the invoice when its amount matches the request', async () => {
    mockInvoiceResponse(INVOICE_1000_SATS)

    await expect(
      requestLNURLPayInvoice('https://service.example/cb', 1000)
    ).resolves.toBe(INVOICE_1000_SATS)
  })

  it('rejects an invoice for a larger amount than requested', async () => {
    mockInvoiceResponse(INVOICE_100000_SATS)

    await expect(
      requestLNURLPayInvoice('https://service.example/cb', 1000)
    ).rejects.toThrow('different amount')
  })

  it('rejects an invoice for a smaller amount than requested', async () => {
    mockInvoiceResponse(INVOICE_1000_SATS)

    await expect(
      requestLNURLPayInvoice('https://service.example/cb', 100_000)
    ).rejects.toThrow('different amount')
  })

  it('rejects an amountless invoice', async () => {
    mockInvoiceResponse(INVOICE_AMOUNTLESS)

    await expect(
      requestLNURLPayInvoice('https://service.example/cb', 1000)
    ).rejects.toThrow('without an amount')
  })

  it('rejects an undecodable invoice', async () => {
    mockInvoiceResponse('lnbc1notavalidinvoice')

    await expect(
      requestLNURLPayInvoice('https://service.example/cb', 1000)
    ).rejects.toThrow('invalid invoice')
  })

  it('requests the callback with the amount in millisats', async () => {
    const fetchMock = mockInvoiceResponse(INVOICE_1000_SATS)

    await requestLNURLPayInvoice('https://service.example/cb', 1000)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('amount=1000000')
    )
  })
})
