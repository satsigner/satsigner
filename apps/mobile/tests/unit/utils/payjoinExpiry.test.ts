import { bech32 } from 'bech32'

import {
  formatPayjoinExpiryLabel,
  formatPayjoinExpiringLabel,
  parsePayjoinExpiresAtMs,
  payjoinExpiresInMinutes
} from '@/utils/payjoinExpiry'

describe('payjoinExpiry', () => {
  const now = 1_700_000_000_000

  it('ceils remaining time to whole minutes', () => {
    expect(payjoinExpiresInMinutes(now + 60_000, now)).toBe(1)
    expect(payjoinExpiresInMinutes(now + 60_001, now)).toBe(2)
    expect(payjoinExpiresInMinutes(now + 9 * 60_000, now)).toBe(9)
  })

  it('returns null when expired', () => {
    expect(payjoinExpiresInMinutes(now - 1, now)).toBeNull()
    expect(formatPayjoinExpiringLabel(now - 1, now)).toBeNull()
  })

  it('formats an expiring label', () => {
    expect(formatPayjoinExpiringLabel(now + 8 * 60_000, now)).toBe(
      'Expiring in 8 min'
    )
  })

  it('formats expired when past', () => {
    expect(formatPayjoinExpiryLabel(now - 1, now)).toBe('Expired')
  })

  it('parses BIP77 EX fragment as little-endian unix time', () => {
    // Round-trip encode/decode with the same bech32 rules as rust-payjoin.
    const unixSeconds = 1_784_726_422
    const buf = Buffer.alloc(4)
    buf.writeUInt32LE(unixSeconds)
    const words = bech32.toWords([...buf])
    const charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
    const ex = `EX1${words
      .map((w) => charset[w])
      .join('')
      .toUpperCase()}`
    const pj = `https://payjo.in/ABC123#${ex}-OH1MOCK-RK1MOCK`
    expect(parsePayjoinExpiresAtMs(pj)).toBe(unixSeconds * 1000)
    expect(
      parsePayjoinExpiresAtMs(
        `bitcoin:tb1qtest?amount=0.00001&pjos=0&pj=${encodeURIComponent(pj)}`
      )
    ).toBe(unixSeconds * 1000)
  })

  it('returns undefined for BIP78 endpoints without EX', () => {
    expect(
      parsePayjoinExpiresAtMs('https://example.com/payjoin')
    ).toBeUndefined()
  })
})
