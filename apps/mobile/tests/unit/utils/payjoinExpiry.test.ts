import { formatPayjoinExpiringLabel, payjoinExpiresInMinutes } from '@/utils/payjoinExpiry'

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
})
