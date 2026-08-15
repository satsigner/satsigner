import { PSBT_MAGIC_HEX, SATS_PER_BITCOIN } from '@/constants/btc'
import { isBitcoinUri, parseBitcoinUri } from '@/utils/bip321'
import { isBitcoinAddress } from '@/utils/bitcoin'
import { validateAddress } from '@/utils/validation'

type ProcessedBitcoinContent = {
  type: 'psbt' | 'address' | 'bip21'
  address?: string
  amount?: number
  label?: string
  content: string
}

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

export function isValidBitcoinContent(text: string) {
  if (!text || text.trim().length === 0) {
    return false
  }

  const trimmed = text.trim()

  if (isPSBT(trimmed)) {
    return true
  }

  if (validateAddress(trimmed)) {
    return true
  }

  if (isBitcoinUri(trimmed)) {
    return true
  }

  if (trimmed.toLowerCase().startsWith('bitcoin:')) {
    const [addressPart] = trimmed.substring(8).split('?')
    if (validateAddress(addressPart) || isBitcoinAddress(addressPart)) {
      return true
    }
  }

  return false
}

export function processBitcoinContent(
  text: string
): ProcessedBitcoinContent | null {
  if (!text || !isValidBitcoinContent(text)) {
    return null
  }

  const trimmed = text.trim()

  if (isPSBT(trimmed)) {
    return {
      content: trimmed,
      type: 'psbt'
    }
  }

  if (isBitcoinUri(trimmed)) {
    const parsed = parseBitcoinUri(trimmed)
    if (!parsed.isValid || !parsed.address) {
      return null
    }

    return {
      address: parsed.address,
      amount: (parsed.amount || 0) * SATS_PER_BITCOIN || 1,
      content: trimmed,
      label: parsed.label || '',
      type: 'bip21'
    }
  }

  let processedAddress = trimmed
  if (processedAddress.toLowerCase().startsWith('bitcoin:')) {
    ;[processedAddress] = processedAddress.substring(8).split('?')
  }

  if (validateAddress(processedAddress)) {
    return {
      address: processedAddress,
      amount: 1,
      content: trimmed,
      label: '',
      type: 'address'
    }
  }

  return null
}
