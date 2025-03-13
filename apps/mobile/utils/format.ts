import { t } from '@/locales'
import { type PageParams } from '@/types/navigation/page'

function formatAddress(address: string, character: number = 8) {
  if (address.length <= 16) return address

  const beginning = address.substring(0, character)
  const end = address.substring(address.length - character, address.length)
  return `${beginning}...${end}`
}

function formatNumber(
  n: number,
  decimals = 0,
  padding = false,
  separator = ' '
) {
  const formatted = padding
    ? (n / 10 ** 8).toFixed(8)
    : n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })

  const [integerPart, decimalPart] = formatted.split('.')
  const formattedInteger = integerPart.replace(
    /(\d)(?=(\d{3})+(?!\d))/g,
    '$1' + separator
  )

  return decimalPart !== undefined
    ? `${formattedInteger}.${decimalPart}`
    : formattedInteger

  // return formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + separator)
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

function formatTimestamp(date: Date) {
  return Math.floor(date.getTime() / 1000)
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

function formatPercentualChange(value: number, base: number) {
  if (value > base)
    return '+' + formatNumber(((value - base) * 100) / base, 1) + '%'
  else return '-' + formatNumber(((base - value) * 100) / base, 1) + '%'
}

function formatFiatPrice(sats: number, btcPrice: number) {
  const SATS_PER_BITCOIN = 100_000_000
  return formatNumber((sats * btcPrice) / SATS_PER_BITCOIN, 2)
}

function formatConfirmations(confirmations: number) {
  if (confirmations <= 0) return t('bitcoin.confirmations.unconfirmed')

  if (confirmations === 1)
    return `1 ${t('bitcoin.confirmations.oneBlock').toLowerCase()}`

  const manyBlocks = t('bitcoin.confirmations.manyBlocks').toLowerCase()

  if (confirmations < 6) return `${confirmations} ${manyBlocks}`
  if (confirmations < 10) return `6+ ${manyBlocks}`
  if (confirmations < 100) return `10+ ${manyBlocks}`
  if (confirmations < 1_000) return `100+ ${manyBlocks}`
  if (confirmations < 10_000) return `1k+ ${manyBlocks}`
  if (confirmations < 100_000) return `10k+ ${manyBlocks}`
  return `100k+ ${manyBlocks}`
}

export {
  formatAddress,
  formatConfirmations,
  formatDate,
  formatFiatPrice,
  formatNumber,
  formatPageUrl,
  formatPercentualChange,
  formatTime,
  formatTimestamp
}
