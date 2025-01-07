import { type PageParams } from '@/types/navigation/page'

function formatAddress(address: string, character: number = 8) {
  if (address.length <= 16) return address

  const beginning = address.substring(0, character)
  const end = address.substring(address.length - character, address.length)
  return `${beginning}...${end}`
}

function formatNumber(n: number, decimals = 0) {
  return decimals > 0
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })
    : n.toLocaleString()
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric'
  })
    .format(date)
    .replace(' ', '')
    .toLowerCase()
}

function formatDate(date: Date | string | number) {
  const dateObj =
    typeof date === 'string' || typeof date === 'number' ? new Date(date) : date

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(dateObj)
}

function formatLabel(rawLabel: string) {
  if (!rawLabel.match(/tags:.*$/)) return { label: rawLabel, tags: [] }

  const tags = rawLabel.replace(/^.*tags:/, '').split(',')
  const label = rawLabel.replace(/ tags:.*$/, '')
  return { label, tags }
}

function formatPageUrl(path: string, params: PageParams) {
  let url = '/' + (path || '')
  for (const key in params) {
    const value = '' + params[key]
    url = url.replace(new RegExp('\\[' + key + '\\]'), value)
  }
  url = url.replace(/index$/, '')
  return url
}

export {
  formatAddress,
  formatDate,
  formatLabel,
  formatNumber,
  formatPageUrl,
  formatTime
}
