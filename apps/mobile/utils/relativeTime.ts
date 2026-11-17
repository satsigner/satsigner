import { t } from '@/locales'

const MS_MIN = 60_000
const MS_HOUR = 3_600_000
const MS_DAY = 86_400_000
const MS_48H = 48 * MS_HOUR

function formatCreatedRelative(createdMs: number, nowMs: number): string {
  const ms = Math.max(0, nowMs - createdMs)
  if (ms < MS_MIN) {
    return t('lightning.paymentDetails.relative.justNow')
  }
  if (ms < MS_HOUR) {
    return t('lightning.paymentDetails.relative.minutesAgo', {
      count: Math.max(1, Math.floor(ms / MS_MIN))
    })
  }
  if (ms < MS_48H) {
    return t('lightning.paymentDetails.relative.hoursAgo', {
      count: Math.max(1, Math.floor(ms / MS_HOUR))
    })
  }
  return t('lightning.paymentDetails.relative.daysAgo', {
    count: Math.max(1, Math.floor(ms / MS_DAY))
  })
}

function formatExpiresRelative(expiresMs: number, nowMs: number): string {
  const ms = expiresMs - nowMs
  if (ms <= 0) {
    return t('lightning.paymentDetails.relative.expired')
  }
  if (ms < MS_MIN) {
    return t('lightning.paymentDetails.relative.inMinutes', { count: 1 })
  }
  if (ms < MS_HOUR) {
    return t('lightning.paymentDetails.relative.inMinutes', {
      count: Math.max(1, Math.ceil(ms / MS_MIN))
    })
  }
  if (ms < MS_48H) {
    return t('lightning.paymentDetails.relative.inHours', {
      count: Math.max(1, Math.ceil(ms / MS_HOUR))
    })
  }
  return t('lightning.paymentDetails.relative.inDays', {
    count: Math.max(1, Math.ceil(ms / MS_DAY))
  })
}

export { formatCreatedRelative, formatExpiresRelative }
