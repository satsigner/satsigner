import { MS_PER_SECOND } from '@/constants/time'

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const UNIX_SECONDS_RE = /^\d+$/

/**
 * Unix seconds for a NIP-52 date-based event (kind 31922) date. The spec uses
 * YYYY-MM-DD, read as UTC midnight; some clients write unix seconds instead.
 */
export function parseCalendarDate(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  if (UNIX_SECONDS_RE.test(value)) {
    return Number(value)
  }
  const match = ISO_DATE_RE.exec(value)
  if (!match) {
    return null
  }
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  return isRealDate ? date.getTime() / MS_PER_SECOND : null
}
