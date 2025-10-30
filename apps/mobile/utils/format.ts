import { SATS_PER_BITCOIN } from '@/constants/btc'
import { t } from '@/locales'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
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
  return formatNumber((sats * btcPrice) / SATS_PER_BITCOIN, 2)
}

function formatConfirmations(confirmations: number) {
  if (confirmations <= 0) {
    return t('bitcoin.confirmations.unconfirmed')
  }

  if (confirmations === 1) {
    return t('bitcoin.confirmations.oneBlock')
  }

  const manyBlocks = (blocks: string) =>
    t('bitcoin.confirmations.manyBlocks', { blocks })

  if (confirmations < 1_000) {
    return manyBlocks(`${confirmations}`)
  }

  if (confirmations < 1_000_000) {
    const roundedValue = Math.round(confirmations / 1_000)
    return manyBlocks(`~${roundedValue}k`)
  }

  const roundedValue = Math.round(confirmations / 1_000_000)

  return manyBlocks(`~${roundedValue}M`)
}

type TimeFromNow = [
  number,
  'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'
]

function formatTimeFromNow(milliseconds: number): TimeFromNow {
  const seconds = milliseconds / 1000
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24
  const weeks = days / 7
  const months = days / 30 // Approximate
  const years = days / 365 // Approximate

  if (years >= 1) {
    return [years, 'year']
  }
  if (months >= 1) {
    return [months, 'month']
  }
  if (weeks >= 1) {
    return [weeks, 'week']
  }
  if (days >= 1) {
    return [days, 'day']
  }
  if (hours >= 1) {
    return [hours, 'hour']
  }
  if (minutes >= 1) {
    return [minutes, 'minute']
  }
  return [seconds, 'second']
}

function formatTxId(txid: string, character: number = 6) {
  const beginning = txid.substring(0, character)
  const end = txid.substring(txid.length - character, txid.length)
  return `${beginning}...${end}`
}

function formatTxOutputToUtxo(
  tx: Transaction | undefined,
  vout: number,
  keychain: 'internal' | 'external' = 'external'
): Utxo | undefined {
  if (!tx || !tx.vout[vout]) return undefined
  const output = tx.vout[vout]
  return {
    txid: tx.id,
    vout,
    value: output.value,
    label: output.label,
    addressTo: output.address,
    script: output.script,
    timestamp: tx.timestamp,
    keychain
  }
}
    
function trimOnionAddress(url: string): string {
  // Check if URL contains an onion address
  const onionMatch = url.match(/([a-z2-7]{16,56}\.onion)(:\d+)?/i)
  if (!onionMatch) {
    return url // Return original if no onion address found
  }

  const fullOnion = onionMatch[1] // e.g., "wilqrsi66cnsbrksba2wvjs8727dwytgqf7ybi3wc4cn72nbv7ce6uzsid.onion"
  const port = onionMatch[2] || '' // e.g., ":50002" or empty string

  const onionPart = fullOnion.replace('.onion', '') // Remove .onion suffix
  const first5 = onionPart.substring(0, 5)
  const last5 = onionPart.substring(onionPart.length - 5)

  const trimmedOnion = `${first5}...${last5}.onion${port}`

  // Replace the full onion address with the trimmed version
  return url.replace(onionMatch[0], trimmedOnion)
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
  formatTimeFromNow,
  formatTimestamp,
  formatTxId,
  formatTxOutputToUtxo,
  trimOnionAddress
}
