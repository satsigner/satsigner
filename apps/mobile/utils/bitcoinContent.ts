import { SATS_PER_BITCOIN } from '@/constants/btc'
import { isBitcoinUri, parseBitcoinUri } from '@/utils/bip321'
import { isBitcoinAddress } from '@/utils/bitcoin'
import { validateAddress } from '@/utils/validation'

interface ProcessedBitcoinContent {
  type: 'psbt' | 'address' | 'bip21'
  address?: string
  amount?: number
  label?: string
  content: string
}

export function isPSBT(text: string) {
  const trimmed = text.trim()

  const isBase64PSBT = trimmed.startsWith('cHNidP8B') && trimmed.length > 50

  const isHexPSBT =
    /^[0-9a-fA-F]+$/.test(trimmed) &&
    (trimmed.startsWith('70736274ff') || trimmed.startsWith('70736274FF')) &&
    trimmed.length > 100

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
    const addressPart = trimmed.slice(8).split('?')[0]
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
    processedAddress = processedAddress.slice(8).split('?')[0]
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
