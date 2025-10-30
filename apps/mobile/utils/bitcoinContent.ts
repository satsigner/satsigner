import { SATS_PER_BITCOIN } from '@/constants/btc'
import { bip21decode, isBip21, isBitcoinAddress } from '@/utils/bitcoin'
import { validateAddress } from '@/utils/validation'

export function isPSBT(text: string): boolean {
  const trimmed = text.trim()

  // Check for base64 PSBT format (starts with 'cHNidP8B' which is base64 for 'psbt\xff')
  const isBase64PSBT = trimmed.startsWith('cHNidP8B') && trimmed.length > 50

  // Check for hex PSBT format (starts with '70736274ff' or '70736274FF' which is hex for 'psbt\xff')
  const isHexPSBT =
    /^[0-9a-fA-F]+$/.test(trimmed) &&
    (trimmed.startsWith('70736274ff') || trimmed.startsWith('70736274FF')) &&
    trimmed.length > 100

  return isBase64PSBT || isHexPSBT
}

export function isValidBitcoinContent(text: string): boolean {
  if (!text || text.trim().length === 0) return false

  const trimmed = text.trim()

  // Check if it's a PSBT
  if (isPSBT(trimmed)) return true

  // Check if it's a Bitcoin address using the robust validation function
  if (validateAddress(trimmed)) return true

  // Check if it's a BIP21 URI
  if (isBip21(trimmed)) return true

  // Check if it's a bitcoin: URI (remove prefix and check address)
  if (trimmed.toLowerCase().startsWith('bitcoin:')) {
    const addressPart = trimmed.substring(8)
    if (validateAddress(addressPart)) return true
  }

  return false
}

export type ProcessedBitcoinContent = {
  type: 'psbt' | 'address' | 'bip21'
  address?: string
  amount?: number
  label?: string
  content: string
}

export function processBitcoinContent(
  text: string
): ProcessedBitcoinContent | null {
  if (!text || !isValidBitcoinContent(text)) return null

  const trimmed = text.trim()

  // Handle PSBT
  if (isPSBT(trimmed)) {
    return {
      type: 'psbt',
      content: trimmed
    }
  }

  // Handle BIP21 URI
  if (isBip21(trimmed)) {
    const decodedData = bip21decode(trimmed)
    if (!decodedData || typeof decodedData === 'string') return null

    return {
      type: 'bip21',
      address: decodedData.address,
      amount: (decodedData.options.amount || 0) * SATS_PER_BITCOIN || 1,
      label: decodedData.options.label || '',
      content: trimmed
    }
  }

  // Handle Bitcoin address
  let processedAddress = trimmed
  if (processedAddress.toLowerCase().startsWith('bitcoin:')) {
    processedAddress = processedAddress.substring(8)
  }

  if (validateAddress(processedAddress)) {
    return {
      type: 'address',
      address: processedAddress,
      amount: 1,
      label: '',
      content: trimmed
    }
  }

  return null
}
