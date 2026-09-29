import { PSBT_MAGIC_HEX } from '@/constants/btc'

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
