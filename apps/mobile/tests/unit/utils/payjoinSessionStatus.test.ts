import {
  isPayjoinFallback,
  isPayjoinSuccess,
  isPayjoinTerminal
} from '@/utils/payjoinSessionStatus'

describe('payjoinSessionStatus', () => {
  it('treats only completed as success', () => {
    expect(isPayjoinSuccess('completed')).toBe(true)
    expect(isPayjoinSuccess('fallback')).toBe(false)
    expect(isPayjoinSuccess('waiting')).toBe(false)
  })

  it('identifies fallback separately from success', () => {
    expect(isPayjoinFallback('fallback')).toBe(true)
    expect(isPayjoinFallback('completed')).toBe(false)
  })

  it('marks terminal statuses', () => {
    for (const status of [
      'cancelled',
      'completed',
      'error',
      'expired',
      'fallback'
    ] as const) {
      expect(isPayjoinTerminal(status)).toBe(true)
    }
    expect(isPayjoinTerminal('waiting')).toBe(false)
    expect(isPayjoinTerminal('negotiating')).toBe(false)
  })
})
