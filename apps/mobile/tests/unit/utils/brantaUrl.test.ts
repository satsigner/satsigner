import {
  brantaHttpsUrl,
  brantaLogoUrl,
  brantaRequestsBlocked
} from '@/utils/brantaUrl'

describe('brantaHttpsUrl', () => {
  it('keeps https on Branta hosts, including the verify fragment', () => {
    expect(
      brantaHttpsUrl(' https://guardrail.branta.pro/v2/verify/abc#k-1=secret ')
    ).toBe('https://guardrail.branta.pro/v2/verify/abc#k-1=secret')
    expect(
      brantaHttpsUrl('https://staging.guardrail.branta.pro/logo.png')
    ).toBe('https://staging.guardrail.branta.pro/logo.png')
  })

  it('rejects other hosts, http, ports, and credentials', () => {
    expect(brantaHttpsUrl('https://example.com/logo.png')).toBeUndefined()
    expect(
      brantaHttpsUrl('https://guardrail.branta.pro.example.com/logo.png')
    ).toBeUndefined()
    expect(
      brantaHttpsUrl('https://guardrail.branta.pro@example.com/logo.png')
    ).toBeUndefined()
    expect(
      brantaHttpsUrl('https://guardrail.branta.pro:8443/logo.png')
    ).toBeUndefined()
    expect(
      brantaHttpsUrl('http://guardrail.branta.pro/logo.png')
    ).toBeUndefined()
    expect(
      brantaHttpsUrl('https://user:pass@guardrail.branta.pro/logo.png')
    ).toBeUndefined()
    expect(brantaHttpsUrl('not a url')).toBeUndefined()
  })
})

describe('brantaRequestsBlocked', () => {
  it('blocks Branta requests only while lookups are off', () => {
    expect(brantaRequestsBlocked({ brantaLookupMode: 'off' })).toBe(true)
    expect(brantaRequestsBlocked({ brantaLookupMode: 'manual' })).toBe(false)
    expect(brantaRequestsBlocked({ brantaLookupMode: 'always' })).toBe(false)
  })
})

describe('brantaLogoUrl', () => {
  it('does not load a logo while Branta requests are blocked', () => {
    expect(
      brantaLogoUrl('https://guardrail.branta.pro/logo.png', true)
    ).toBeUndefined()
    expect(brantaLogoUrl('https://guardrail.branta.pro/logo.png', false)).toBe(
      'https://guardrail.branta.pro/logo.png'
    )
  })
})
