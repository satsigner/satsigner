import {
  HASH_HEX_LENGTH,
  PSBT_MAGIC_HEX,
  TXID_HEX_PATTERN
} from '@/constants/btc'

// Heuristic minimum lengths for a plausible base64/hex-encoded PSBT.
const PSBT_BASE64_MIN_LENGTH = 50
const PSBT_HEX_MIN_LENGTH = 100

export function isPSBT(text: string) {
  const trimmed = text.trim()

  const isBase64PSBT =
    trimmed.startsWith('cHNidP8B') && trimmed.length > PSBT_BASE64_MIN_LENGTH

  const isHexPSBT =
    /^[0-9a-fA-F]+$/.test(trimmed) &&
    trimmed.toLowerCase().startsWith(PSBT_MAGIC_HEX) &&
    trimmed.length > PSBT_HEX_MIN_LENGTH

  return isBase64PSBT || isHexPSBT
}

/**
 * A finalized transaction ready to broadcast: plain hex that is not a PSBT.
 * A partly signed PSBT must never be treated as one.
 */
export function isFinalTransactionHex(text: string) {
  const trimmed = text.trim()
  return (
    trimmed.length > 0 &&
    trimmed.length % 2 === 0 &&
    /^[0-9a-fA-F]+$/.test(trimmed) &&
    !trimmed.toLowerCase().startsWith(PSBT_MAGIC_HEX)
  )
}

export function detectTransactionSearchInput(text: string) {
  const trimmed = text.trim()
  if (TXID_HEX_PATTERN.test(trimmed)) {
    return 'txid'
  }
  if (trimmed.length > HASH_HEX_LENGTH && isFinalTransactionHex(trimmed)) {
    return 'rawTx'
  }
  return null
}
