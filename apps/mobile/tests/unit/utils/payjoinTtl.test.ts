import {
  PAYJOIN_SESSION_TTL_MS,
  PAYJOIN_SESSION_TTL_PRESETS_MS
} from '@/constants/payjoin'
import {
  isPayjoinSessionTtlPreset,
  normalizePayjoinSessionTtlMs
} from '@/utils/payjoinTtl'

describe('payjoinTtl', () => {
  it('accepts only preset values', () => {
    for (const ms of PAYJOIN_SESSION_TTL_PRESETS_MS) {
      expect(isPayjoinSessionTtlPreset(ms)).toBe(true)
      expect(normalizePayjoinSessionTtlMs(ms)).toBe(ms)
    }
    expect(isPayjoinSessionTtlPreset(7 * 60 * 1000)).toBe(false)
    expect(normalizePayjoinSessionTtlMs(7 * 60 * 1000)).toBe(
      PAYJOIN_SESSION_TTL_MS
    )
    expect(normalizePayjoinSessionTtlMs(undefined)).toBe(PAYJOIN_SESSION_TTL_MS)
  })

  it('defaults to five minutes', () => {
    expect(PAYJOIN_SESSION_TTL_MS).toBe(5 * 60 * 1000)
  })
})
