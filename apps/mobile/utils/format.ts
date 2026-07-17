import { SATS_PER_BITCOIN } from '@/constants/btc'
import { i18n, t } from '@/locales'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type PageParams } from '@/types/navigation/page'
import { bytes as _bytes } from '@/utils/bytes'

function formatAddress(address: string, character = 8) {
  if (address.length <= 16) {
    return address
  }

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
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
      })

  const [integerPart, decimalPart] = formatted.split('.')
  const formattedInteger = integerPart.replace(
    /(\d)(?=(\d{3})+(?!\d))/g,
    `$1${separator}`
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

/**
 * Nostr note and zap cards: `Apr 15, 26` (MMM DD, YY). `unixSeconds` is event `created_at`.
 */
function formatNostrCardDate(unixSeconds: number): string {
  if (!unixSeconds) {
    return ''
  }
  const d = new Date(unixSeconds * 1000)
  const dd = String(d.getDate()).padStart(2, '0')
  const mmm = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d)
  const yyyy = String(d.getFullYear())
  return `${mmm} ${dd}, ${yyyy} · ${formatTime(d)}`
}

function formatDate(date: Date | string | number) {
  const dateObj =
    typeof date === 'string' || typeof date === 'number' ? new Date(date) : date

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(dateObj)
}

function formatTimestamp(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

function formatPageUrl(path: string, params: PageParams) {
  let url = `/${path || ''}`

  for (const [key, paramValue] of Object.entries(params)) {
    const value = String(paramValue)
    url = url.replace(new RegExp(`\\[${key}\\]`), value)
  }

  url = url.replace(/index$/, '')

  return url
}

function formatPercentualChange(value: number, base: number) {
  if (value > base) {
    return `+${formatNumber(((value - base) * 100) / base, 1)}%`
  }
  return `-${formatNumber(((base - value) * 100) / base, 1)}%`
}

function formatFiatPrice(sats: number, btcPrice: number) {
  return formatNumber((sats * btcPrice) / SATS_PER_BITCOIN, 2)
}

function formatConfirmationCount(confirmations: number) {
  if (confirmations < 1_000) {
    return `${confirmations}`
  }

  if (confirmations < 1_000_000) {
    const roundedValue = Math.round(confirmations / 1_000)
    return `~${roundedValue}k`
  }

  const roundedValue = Math.round(confirmations / 1_000_000)

  return `~${roundedValue}M`
}

function formatConfirmations(confirmations: number) {
  if (confirmations <= 0) {
    return t('bitcoin.confirmations.unconfirmed')
  }

  if (confirmations === 1) {
    return t('bitcoin.confirmations.oneBlock')
  }

  return t('bitcoin.confirmations.manyBlocks', {
    blocks: formatConfirmationCount(confirmations)
  })
}

function formatConfirmationsWithBlock(
  confirmations: number,
  blockHeight: number
) {
  const confLabel =
    confirmations === 1
      ? t('bitcoin.confirmations.oneConf')
      : t('bitcoin.confirmations.manyConfs', {
          blocks: formatConfirmationCount(confirmations)
        })

  return `${confLabel} • ${blockHeight.toLocaleString('en-US')}`
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

function formatTxId(txid: string, character = 6) {
  if (!txid) {
    return ''
  }
  if (txid.includes('...') || txid.length <= character * 2 + 3) {
    return txid
  }

  const beginning = txid.substring(0, character)
  const end = txid.substring(txid.length - character, txid.length)
  return `${beginning}...${end}`
}

function formatShortPubkey(pubkey: string, headChars = 5, tailChars = 6) {
  const s = pubkey.trim()
  if (!s) {
    return ''
  }
  if (s.length <= headChars + tailChars + 3) {
    return s
  }
  return `${s.slice(0, headChars)}...${s.slice(-tailChars)}`
}

function formatTxOutputToUtxo(
  tx: Transaction | undefined,
  vout: number,
  keychain: 'internal' | 'external' = 'external'
): Utxo | undefined {
  if (!tx || !tx.vout[vout]) {
    return undefined
  }
  const output = tx.vout[vout]
  return {
    addressTo: output.address,
    keychain,
    label: output.label,
    script: output.script,
    timestamp: tx.timestamp,
    txid: tx.id,
    value: output.value,
    vout
  }
}

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) {
    return `${_bytes.toMega(bytes).toFixed(2)} MB`
  }
  if (bytes >= 1_000) {
    return `${_bytes.toKilo(bytes).toFixed(1)} KB`
  }
  return `${bytes} B`
}

const QUADRILLION = 1e15
const BILLIARD = 1e15
const TRILLION_LONG = 1e18
const TRILLIARD = 1e21

const COMPACT_LONG_OPTS: Intl.NumberFormatOptions = {
  compactDisplay: 'long',
  notation: 'compact'
}

function formatScaledWord(
  num: number,
  divisor: number,
  wordKey: string
): string {
  const isNegative = num < 0
  const abs = Math.abs(num)
  const rounded = Math.round(abs / divisor)
  const approx = rounded * divisor !== abs ? '~' : ''
  const word = t(`numbers.${wordKey}`)
  const plural = rounded > 1 ? 's' : ''
  return `${isNegative ? '-' : ''}${approx}${rounded} ${word}${plural}`
}

function formatLargeNumber(
  num: number,
  european = false,
  locale = i18n.locale
): string {
  if (!isFinite(num) || num === 0 || Math.abs(num) < 1e3) {
    return ''
  }

  if (european && Math.abs(num) >= BILLIARD) {
    if (Math.abs(num) >= TRILLIARD) {
      return formatScaledWord(num, TRILLIARD, 'trilliard')
    }
    if (Math.abs(num) >= TRILLION_LONG) {
      return formatScaledWord(num, TRILLION_LONG, 'trillion')
    }
    return formatScaledWord(num, BILLIARD, 'billiard')
  }

  if (!european && Math.abs(num) >= QUADRILLION) {
    return formatScaledWord(num, QUADRILLION, 'quadrillion')
  }

  const intlLocale = european ? 'fr' : locale
  const exact = new Intl.NumberFormat(intlLocale, {
    ...COMPACT_LONG_OPTS,
    maximumFractionDigits: 20
  }).format(num)
  const rounded = new Intl.NumberFormat(intlLocale, {
    ...COMPACT_LONG_OPTS,
    maximumFractionDigits: 0
  }).format(num)

  return (exact !== rounded ? '~' : '') + rounded
}

function trimOnionAddress(url: string): string {
  const onionMatch = url.match(/([a-z2-7]{16,56}\.onion)(:\d+)?/i)
  if (!onionMatch) {
    return url
  }

  const [, fullOnion, matchedPort] = onionMatch
  const port = matchedPort || ''

  const onionPart = fullOnion.replace('.onion', '')
  const first5 = onionPart.substring(0, 5)
  const last5 = onionPart.substring(onionPart.length - 5)

  const trimmedOnion = `${first5}...${last5}.onion${port}`

  return url.replace(onionMatch[0], trimmedOnion)
}

export {
  formatAddress,
  formatBytes,
  formatConfirmations,
  formatConfirmationsWithBlock,
  formatDate,
  formatFiatPrice,
  formatLargeNumber,
  formatNostrCardDate,
  formatNumber,
  formatPageUrl,
  formatPercentualChange,
  formatShortPubkey,
  formatTime,
  formatTimeFromNow,
  formatTimestamp,
  formatTxId,
  formatTxOutputToUtxo,
  trimOnionAddress
}
