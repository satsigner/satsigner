import { bech32 } from 'bech32'

import { t } from '@/locales'
import { parsePayjoinUri } from '@/utils/payjoinUri'

const MS_MIN = 60_000
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

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

/**
 * Expiring label, or "Expired" when past. Null when expiry cannot be known.
 */
function formatPayjoinExpiryLabel(
  expiresAt: number | undefined,
  nowMs = Date.now()
): string | null {
  if (expiresAt === undefined || !Number.isFinite(expiresAt)) {
    return null
  }
  return (
    formatPayjoinExpiringLabel(expiresAt, nowMs) ??
    t('transaction.build.payjoin.data.expired')
  )
}

/**
 * BIP77 `EX` fragment param → absolute expiry in ms.
 * Encoded as bech32 (no checksum) HRP `EX` + 4-byte little-endian unix time.
 */
function parsePayjoinExpiresAtMs(pjOrUri: string): number | undefined {
  let pjEndpoint = pjOrUri.trim()
  if (!pjEndpoint) {
    return undefined
  }

  const looksLikeBitcoinUri =
    pjEndpoint.toLowerCase().startsWith('bitcoin:') ||
    pjEndpoint.toLowerCase().includes('pj=')
  if (looksLikeBitcoinUri) {
    const withPrefix = pjEndpoint.toLowerCase().startsWith('bitcoin:')
      ? pjEndpoint
      : `bitcoin:${pjEndpoint}`
    const parsed = parsePayjoinUri(withPrefix)
    pjEndpoint = parsed.params?.pj ?? ''
  }

  const hashIndex = pjEndpoint.indexOf('#')
  if (hashIndex === -1) {
    return undefined
  }

  const fragment = pjEndpoint.slice(hashIndex + 1).replace(/\+/g, '-')
  const exParam = fragment
    .split('-')
    .find((part) => part.toUpperCase().startsWith('EX1'))
  if (!exParam) {
    return undefined
  }

  try {
    const lower = exParam.toLowerCase()
    const sep = lower.lastIndexOf('1')
    if (sep < 2) {
      return undefined
    }
    if (lower.slice(0, sep) !== 'ex') {
      return undefined
    }
    const data = lower.slice(sep + 1)
    const words: number[] = []
    for (const char of data) {
      const index = BECH32_CHARSET.indexOf(char)
      if (index < 0) {
        return undefined
      }
      words.push(index)
    }
    const bytes = bech32.fromWords(words)
    if (bytes.length !== 4) {
      return undefined
    }
    // Bitcoin consensus encoding of u32 is little-endian.
    const unixSeconds =
      (bytes[0]! |
        (bytes[1]! << 8) |
        (bytes[2]! << 16) |
        (bytes[3]! << 24)) >>>
      0
    // Guard against mock / garbage EX values.
    if (unixSeconds < 1_000_000_000) {
      return undefined
    }
    return unixSeconds * 1000
  } catch {
    return undefined
  }
}

export {
  formatPayjoinExpiryLabel,
  formatPayjoinExpiringLabel,
  parsePayjoinExpiresAtMs,
  payjoinExpiresInMinutes
}
