import { type ConnectionTestResult } from '@/hooks/useConnectionTest'
import { tn as _tn } from '@/locales'
import { formatDate } from '@/utils/date'

const tnServer = _tn('settings.network.server')

const TOAST_BANNER_MAX_CHARS = 160
const TOAST_BANNER_MAX_LINES = 3

/** Compact banner copy for toasts (Electrum ASCII or Sparrow-style Core lines). */
export function formatBannerForToast(banner: string): string {
  const lines = banner
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, TOAST_BANNER_MAX_LINES)

  const joined = lines.join(' · ')
  if (joined.length <= TOAST_BANNER_MAX_CHARS) {
    return joined
  }
  return `${joined.slice(0, TOAST_BANNER_MAX_CHARS - 1)}…`
}

export function successProbeDescription(
  result: Extract<ConnectionTestResult, { success: true }>
): string {
  const dateSec = result.tipTimestampSec ?? Math.floor(Date.now() / 1000)
  const dateStr = formatDate(dateSec)
  if (
    result.blockHeight !== null &&
    result.blockHeight !== undefined &&
    result.blockHeight > 0
  ) {
    return tnServer('tester.successDetail', {
      date: dateStr,
      height: result.blockHeight.toLocaleString()
    })
  }
  return tnServer('tester.successNoHeight', { date: dateStr })
}

export function successToastDescription(
  result: Extract<ConnectionTestResult, { success: true }>
): string {
  const probeLine = successProbeDescription(result)
  const base = `${tnServer('tester.success')} — ${probeLine}`
  if (!result.banner) {
    return base
  }
  return `${base}\n${tnServer('tester.banner')}: ${formatBannerForToast(
    result.banner
  )}`
}
