import { SATS_PER_BITCOIN } from '@/constants/btc'
import {
  ADDRESS_TRUNCATE_CHARS,
  ADDRESS_TRUNCATE_CHARS_COMPACT,
  ADDRESS_TRUNCATE_CHARS_DEFAULT,
  BILLIARD,
  BYTE_UNIT_DECIMALS,
  BYTES_PER_KB,
  COMPACT_LONG_OPTS,
  FILE_SIZE_UNITS,
  PUBKEY_SHORT_HEAD_CHARS,
  PUBKEY_SHORT_TAIL_CHARS,
  QUADRILLION,
  TRILLIARD,
  TRILLION_LONG,
  TXID_TRUNCATE_CHARS,
  TXID_TRUNCATE_CHARS_COMPACT,
  TXID_TRUNCATE_CHARS_TINY,
  TXID_TRUNCATE_CHARS_WIDE
} from '@/constants/format'
import {
  LN_KEY_SHORT_HEAD_CHARS,
  LN_KEY_SHORT_TAIL_CHARS
} from '@/constants/lightning'
import {
  NOSTR_NPUB_SHORT_HEAD_CHARS,
  NOSTR_NPUB_SHORT_TAIL_CHARS,
  NPUB_TRUNCATE_CHARS_LG,
  NPUB_TRUNCATE_CHARS_MD,
  NPUB_TRUNCATE_CHARS_SM,
  NPUB_TRUNCATE_CHARS_XL,
  NPUB_TRUNCATE_CHARS_XS
} from '@/constants/nostr'
import { i18n, t } from '@/locales'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type PageParams } from '@/types/navigation/page'
import {
  type AddressSize,
  type NpubSize,
  type TxIdSize
} from '@/types/ui/format'

/**
 * Middle-truncate a string to `headChars` leading and `tailChars` trailing
 * characters joined by an ellipsis (e.g. "abcd...wxyz"). `tailChars` defaults
 * to `headChars`. `formatAddress`, `formatShortPubkey`, `formatNpub` and
 * `formatLnKey` are thin aliases that pass their conventional widths.
 */
function truncate(value: string, headChars: number, tailChars = headChars) {
  // Truncating would show every character (plus misleading dots) or overlap
  // the head and tail slices, so just return the whole value.
  if (value.length <= headChars + tailChars) {
    return value
  }

  // slice(-0) returns the whole string, so guard against an empty tail.
  const tail = tailChars > 0 ? value.slice(-tailChars) : ''
  return `${value.slice(0, headChars)}...${tail}`
}

/**
 * Truncate an address. Without `size` it keeps the standard 8-char form;
 * 'default' is the narrower 6-char variant and 'compact' the 4-char one used
 * in dense charts.
 */
function formatAddress(address: string, size?: AddressSize) {
  switch (size) {
    case 'compact':
      return truncate(address, ADDRESS_TRUNCATE_CHARS_COMPACT)
    case 'default':
      return truncate(address, ADDRESS_TRUNCATE_CHARS)
    default:
      return truncate(address, ADDRESS_TRUNCATE_CHARS_DEFAULT)
  }
}

function formatNumber(
  n: number,
  decimals = 0,
  padding = false,
  separator = ' '
) {
  const formatted = padding
    ? (n / SATS_PER_BITCOIN).toFixed(8)
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

/**
 * Chart / UI fee-rate label. Sub-1 sat/vB must not round to "0".
 * Below 1 → two decimals (e.g. 0.39); below 10 with a fraction → one decimal;
 * otherwise → integer.
 */
function formatFeeRateSatPerVb(feeRate: number): string {
  if (!Number.isFinite(feeRate) || feeRate <= 0) {
    return '0'
  }
  if (feeRate < 1) {
    return formatNumber(feeRate, 2)
  }
  if (feeRate < 10 && feeRate % 1 !== 0) {
    return formatNumber(feeRate, 1)
  }
  return formatNumber(Math.round(feeRate), 0)
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

function txIdTruncateChars(size: TxIdSize): number {
  switch (size) {
    case 'tiny':
      return TXID_TRUNCATE_CHARS_TINY
    case 'compact':
      return TXID_TRUNCATE_CHARS_COMPACT
    case 'wide':
      return TXID_TRUNCATE_CHARS_WIDE
    default:
      return TXID_TRUNCATE_CHARS
  }
}

function formatTxId(txid: string, size: TxIdSize = 'default') {
  if (!txid) {
    return ''
  }
  const character = txIdTruncateChars(size)
  if (txid.includes('...') || txid.length <= character * 2 + 3) {
    return txid
  }

  const beginning = txid.substring(0, character)
  const end = txid.substring(txid.length - character, txid.length)
  return `${beginning}...${end}`
}

function formatShortPubkey(pubkey: string) {
  return truncate(pubkey, PUBKEY_SHORT_HEAD_CHARS, PUBKEY_SHORT_TAIL_CHARS)
}

/**
 * Truncate an npub. Without `size` it keeps the conventional 12/4 short form;
 * with `size` it middle-truncates to the matching symmetric NPUB tier.
 */
function formatNpub(npub: string, size?: NpubSize) {
  switch (size) {
    case 'xs':
      return truncate(npub, NPUB_TRUNCATE_CHARS_XS)
    case 'sm':
      return truncate(npub, NPUB_TRUNCATE_CHARS_SM)
    case 'md':
      return truncate(npub, NPUB_TRUNCATE_CHARS_MD)
    case 'lg':
      return truncate(npub, NPUB_TRUNCATE_CHARS_LG)
    case 'xl':
      return truncate(npub, NPUB_TRUNCATE_CHARS_XL)
    default:
      return truncate(
        npub,
        NOSTR_NPUB_SHORT_HEAD_CHARS,
        NOSTR_NPUB_SHORT_TAIL_CHARS
      )
  }
}

function formatLnKey(pubkey: string) {
  return truncate(pubkey, LN_KEY_SHORT_HEAD_CHARS, LN_KEY_SHORT_TAIL_CHARS)
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

/**
 * Human-readable byte size (B/KB/MB/GB). `base` selects SI (1000, default) or
 * binary (1024) units. Bytes stay whole, larger units keep per-unit decimals
 * with trailing zeros stripped ("2 KB", "1.5 MB").
 */
function formatBytes(bytes: number, base: number = BYTES_PER_KB): string {
  const maxUnitIndex = FILE_SIZE_UNITS.length - 1
  const unitIndex =
    bytes < base
      ? 0
      : Math.min(maxUnitIndex, Math.floor(Math.log(bytes) / Math.log(base)))
  const value = bytes / base ** unitIndex
  const rounded = Number(value.toFixed(BYTE_UNIT_DECIMALS[unitIndex]))

  return `${rounded} ${FILE_SIZE_UNITS[unitIndex]}`
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
  formatFeeRateSatPerVb,
  formatFiatPrice,
  formatLargeNumber,
  formatLnKey,
  formatNostrCardDate,
  formatNpub,
  formatNumber,
  formatPageUrl,
  formatPercentualChange,
  formatShortPubkey,
  formatTime,
  formatTimeFromNow,
  formatTimestamp,
  formatTxId,
  formatTxOutputToUtxo,
  trimOnionAddress,
  truncate
}
