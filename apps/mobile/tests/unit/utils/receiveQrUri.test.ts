import { buildReceiveQrUri } from '@/utils/receiveQrUri'

describe('buildReceiveQrUri', () => {
  it('prefers a live payjoin session URI and rewrites amount/label', () => {
    const uri = buildReceiveQrUri({
      amountSats: 1000,
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
