export const formatRelativeTime = (timestamp: string | undefined): string => {
  if (!timestamp) return ''

  const now = Date.now()
  const timestampMs = Number(timestamp) * 1000
  const diffInSeconds = (now - timestampMs) / 1000

  // Define time intervals in seconds
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  }

  // Format the absolute date
  const formattedDate = new Date(timestampMs)
    .toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    .replace(/\//g, '-')
    .replace(/,/g, '') // Remove any commas from the formatted date

  // Calculate relative time
  for (const [unit, seconds] of Object.entries(intervals)) {
    const value = Math.floor(diffInSeconds / seconds)
    if (value >= 1) {
      return `${formattedDate} (${value} ${unit}${value > 1 ? 's' : ''} ago)`
    }
  }

  // Handle cases less than a minute
  if (diffInSeconds < 60) {
    return `${formattedDate} (just now)`
  }

  return formattedDate
}
