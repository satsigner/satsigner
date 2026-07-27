import {
  buildReceiveQrUri,
  shouldIncludePayjoinInUri
} from '@/utils/receiveQrUri'

describe('shouldIncludePayjoinInUri', () => {
  it('includes payjoin when amount is unset', () => {
    expect(shouldIncludePayjoinInUri({})).toBe(true)
  })

  it('includes payjoin at or above the floor', () => {
    expect(shouldIncludePayjoinInUri({ amountSats: 5_000 })).toBe(true)
    expect(shouldIncludePayjoinInUri({ amountSats: 50_000 })).toBe(true)
  })

  it('omits payjoin when amount is below the floor', () => {
    expect(shouldIncludePayjoinInUri({ amountSats: 4_999 })).toBe(false)
    expect(shouldIncludePayjoinInUri({ amountSats: 1_000 })).toBe(false)
  })
})

describe('buildReceiveQrUri', () => {
  it('prefers a live payjoin session URI and rewrites amount/label', () => {
    const uri = buildReceiveQrUri({
      amountSats: 50_000,
      includeBitcoinPrefix: true,
      includeLabel: true,
      includePayjoin: true,
      label: 'coffee',
      localAddress: 'tb1qabc',
      localAddressQR: 'bitcoin:tb1qabc',
      payjoinEnabled: true,
      payjoinSessionAddress: 'tb1qabc',
      payjoinSessionStatus: 'waiting',
      payjoinSessionUri: 'bitcoin:tb1qabc?pj=https://payjo.in/x'
    })

    expect(uri).toContain('bitcoin:tb1qabc')
    expect(uri).toContain('pj=')
    expect(uri).toContain('amount=')
    expect(uri).toContain('label=coffee')
  })

  it('omits pj= when amount is below the anti-probing floor', () => {
    const uri = buildReceiveQrUri({
      amountSats: 1_000,
      includeBitcoinPrefix: true,
      includeLabel: false,
      includePayjoin: true,
      localAddress: 'tb1qabc',
      localAddressQR: 'bitcoin:tb1qabc',
      payjoinEnabled: true,
      payjoinSessionAddress: 'tb1qabc',
      payjoinSessionStatus: 'waiting',
      payjoinSessionUri: 'bitcoin:tb1qabc?pj=https://payjo.in/x'
    })

    expect(uri).toBe('bitcoin:tb1qabc?amount=0.00001')
    expect(uri).not.toContain('pj=')
  })

  it('builds a plain bip21 URI when payjoin is off', () => {
    const uri = buildReceiveQrUri({
      amountSats: 50_000,
      includeBitcoinPrefix: true,
      includeLabel: true,
      includePayjoin: false,
      label: 'tip',
      localAddress: 'tb1qabc',
      localAddressQR: 'bitcoin:tb1qabc',
      payjoinEnabled: true
    })

    expect(uri).toBe('bitcoin:tb1qabc?amount=0.0005&label=tip')
  })
})
