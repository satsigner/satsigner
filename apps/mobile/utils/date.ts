import { t } from '@/locales'

export const formatRelativeTime = (timestamp: number | undefined): string => {
  if (!timestamp) return ''

  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  const minutes = Math.floor(diff / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 1) return `(${t('time.yearsAgo', { value: years })})`
  if (years === 1) return `(${t('time.yearAgo')})`
  if (months > 1) return `(${t('time.monthsAgo', { value: months })})`
  if (months === 1) return `(${t('time.monthAgo')})`
  if (weeks > 1) return `(${t('time.weeksAgo', { value: weeks })})`
  if (weeks === 1) return `(${t('time.weekAgo')})`
  if (days > 1) return `(${t('time.daysAgo', { value: days })})`
  if (days === 1) return `(${t('time.dayAgo')})`
  if (hours > 1) return `(${t('time.hoursAgo', { value: hours })})`
  if (hours === 1) return `(${t('time.hourAgo')})`
  if (minutes > 1) return `(${t('time.minutesAgo', { value: minutes })})`
  if (minutes === 1) return `(${t('time.minuteAgo')})`
  return `(${t('time.justNow')})`
}

export const formatDate = (timestamp: number | undefined): string => {
  if (typeof timestamp !== 'number') return ''

  const date = new Date(timestamp * 1000)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
