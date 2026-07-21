import { t } from '@/locales'

const MS_MIN = 60_000

/** Whole minutes remaining until expiry (ceil). Null when already expired. */
function payjoinExpiresInMinutes(
  expiresAt: number,
  nowMs = Date.now()
): number | null {
  const remainingMs = expiresAt - nowMs
  if (remainingMs <= 0) {
    return null
  }
  return Math.max(1, Math.ceil(remainingMs / MS_MIN))
}

/** e.g. "Expiring in 8 min", or null when expired / missing. */
function formatPayjoinExpiringLabel(
  expiresAt: number | undefined,
  nowMs = Date.now()
): string | null {
  if (expiresAt === undefined || !Number.isFinite(expiresAt)) {
    return null
  }
  const minutes = payjoinExpiresInMinutes(expiresAt, nowMs)
  if (minutes === null) {
    return null
  }
  return t('receive.payjoin.expiringIn', { count: minutes })
}

export { formatPayjoinExpiringLabel, payjoinExpiresInMinutes }
