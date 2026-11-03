import { MS_PER_SECOND } from '@/constants/time'
import { parseCalendarDate } from '@/utils/nostrCalendar'

describe('parseCalendarDate', () => {
  it('reads NIP-52 dates as UTC midnight', () => {
    expect(parseCalendarDate('2026-11-20')).toBe(
      Date.UTC(2026, 10, 20) / MS_PER_SECOND
    )
  })

  it('reads unix seconds written by other clients', () => {
    expect(parseCalendarDate('1795000000')).toBe(1_795_000_000)
  })

  it('rejects missing, malformed and impossible dates', () => {
    expect(parseCalendarDate(undefined)).toBeNull()
    expect(parseCalendarDate('')).toBeNull()
    expect(parseCalendarDate('20 Nov 2026')).toBeNull()
    expect(parseCalendarDate('2026-13-01')).toBeNull()
    expect(parseCalendarDate('2026-02-30')).toBeNull()
  })
})
