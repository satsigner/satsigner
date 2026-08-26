// Validity probe: receive QR URIs must round-trip through the REAL bip-321
// parser (the shared mock only checks superficially).
jest.mock<typeof import('bip-321')>('bip-321', () =>
  jest.requireActual('bip-321')
)

import { parseBIP321 } from 'bip-321'

import { buildReceiveQrUri } from '@/utils/receiveQrUri'

const ADDRESS = 'tb1qfm5z8wn8jxssnw3eq8htz2c24yqcd2aw2y4k5s'

function buildPlain(overrides: Record<string, unknown> = {}) {
  return buildReceiveQrUri({
    includeBitcoinPrefix: true,
    includeLabel: true,
    includePayjoin: false,
    localAddress: ADDRESS,
    localAddressQR: `bitcoin:${ADDRESS}`,
    payjoinEnabled: false,
    ...overrides
  })
}

describe('receive QR bitcoin URI validity', () => {
  it('plain address parses as valid BIP-21/BIP-321', () => {
    const uri = buildPlain()
    const parsed = parseBIP321(uri)
    expect(parsed.valid).toBe(true)
    expect(parsed.address).toBe(ADDRESS)
  })

  it('address + amount round-trips exactly in sats', () => {
    const uri = buildPlain({ amountSats: 123_456 })
    const parsed = parseBIP321(uri)
    expect(parsed.valid).toBe(true)
    expect(parsed.address).toBe(ADDRESS)
    expect(parsed.amount).toBeCloseTo(0.00123456, 12)
  })

  it('address + label with special chars round-trips', () => {
    const label = 'Coffee & croissant 🥐 = $5'
    const uri = buildPlain({ label })
    const parsed = parseBIP321(uri)
    expect(parsed.valid).toBe(true)
    expect(parsed.label).toBe(label)
  })

  it('address + amount + label', () => {
    const uri = buildPlain({ amountSats: 1, label: 'a b&c' })
    expect(uri).toContain('amount=0.00000001')
    const parsed = parseBIP321(uri)
    expect(parsed.valid).toBe(true)
    expect(parsed.label).toBe('a b&c')
  })

  it('omits amount when zero sats (amount=0 is not a valid request)', () => {
    const uri = buildPlain({ amountSats: 0 })
    expect(uri).not.toContain('amount=')
    const parsed = parseBIP321(uri)
    expect(parsed.valid).toBe(true)
  })

  it('payjoin session URI stays valid after amount/label rewrite', () => {
    const uri = buildReceiveQrUri({
      amountSats: 50_000,
      includeBitcoinPrefix: true,
      includeLabel: true,
      includePayjoin: true,
      label: 'my label',
      localAddress: ADDRESS,
      localAddressQR: `bitcoin:${ADDRESS}`,
      payjoinEnabled: true,
      payjoinSessionAddress: ADDRESS,
      payjoinSessionStatus: 'waiting',
      payjoinSessionUri: `bitcoin:${ADDRESS}?pj=https://payjo.in/abc`
    })
    const parsed = parseBIP321(uri)
    expect(parsed.valid).toBe(true)
    expect(parsed.amount).toBeCloseTo(0.0005, 12)
    expect(uri).toContain('pj=')
  })
})
