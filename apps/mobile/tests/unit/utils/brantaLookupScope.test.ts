import { brantaLookupMayReachNetwork } from '@/utils/brantaLookupScope'

const ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'

describe('brantaLookupMayReachNetwork', () => {
  it('stays local for a plain on-chain address', () => {
    expect(brantaLookupMayReachNetwork(` ${ADDRESS} `)).toBe(false)
    expect(
      brantaLookupMayReachNetwork('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')
    ).toBe(false)
  })

  it('stays local for a bitcoin URI with only plain BIP21 params', () => {
    expect(
      brantaLookupMayReachNetwork(
        `bitcoin:${ADDRESS}?amount=0.1&label=Rent&message=March`
      )
    ).toBe(false)
    expect(brantaLookupMayReachNetwork(`BITCOIN:${ADDRESS}`)).toBe(false)
  })

  it('may reach Branta for a URI carrying Branta or derived-key params', () => {
    expect(
      brantaLookupMayReachNetwork(
        `bitcoin:${ADDRESS}?branta_id=1&branta_secret=2`
      )
    ).toBe(true)
    expect(
      brantaLookupMayReachNetwork(`bitcoin:${ADDRESS}?lightning=lnbc1example`)
    ).toBe(true)
    expect(
      brantaLookupMayReachNetwork(`bitcoin:${ADDRESS}?BRANTA%5FID=1`)
    ).toBe(true)
    expect(brantaLookupMayReachNetwork(`bitcoin:${ADDRESS}?unknown=1`)).toBe(
      true
    )
  })

  it('may reach Branta for invoices, ark and silent payment addresses', () => {
    expect(brantaLookupMayReachNetwork('lnbc1example')).toBe(true)
    expect(brantaLookupMayReachNetwork('ark1example')).toBe(true)
    expect(brantaLookupMayReachNetwork('sp1example')).toBe(true)
    expect(brantaLookupMayReachNetwork('bitcoin:notanaddress')).toBe(true)
  })

  it('skips empty input', () => {
    expect(brantaLookupMayReachNetwork('   ')).toBe(false)
  })
})
