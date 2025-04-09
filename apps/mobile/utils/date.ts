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

  if (years >= 2) return `(${years} years ago)`
  if (years === 1) return '(1 year ago)'
  if (months >= 2) return `(${months} months ago)`
  if (months === 1) return '(1 month ago)'
  if (weeks >= 2) return `(${weeks} weeks ago)`
  if (weeks === 1) return '(1 week ago)'
  if (days >= 2) return `(${days} days ago)`
  if (days === 1) return '(1 day ago)'
  if (hours >= 2) return `(${hours} hours ago)`
  if (hours === 1) return '(1 hour ago)'
  if (minutes >= 2) return `(${minutes} minutes ago)`
  if (minutes === 1) return '(1 minute ago)'
  return '(just now)'
}
