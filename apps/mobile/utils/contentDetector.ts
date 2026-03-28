import ecc from '@bitcoinerlab/secp256k1'
import { getDecodedToken } from '@cashu/cashu-ts'
import * as bitcoinjs from 'bitcoinjs-lib'

import { isBBQRFragment } from '@/utils/bbqr'
import { isBitcoinUri, validateBolt12, validateLightning } from '@/utils/bip321'
import { isBitcoinAddress } from '@/utils/bitcoin'
import { isPSBT } from '@/utils/bitcoinContent'
import { isLNURL } from '@/utils/lnurl'
import { stripBitcoinPrefix } from '@/utils/parse'
import { detectAndDecodeSeedQR } from '@/utils/seedqr'
import {
  isCombinedDescriptor,
  validateDescriptorFormat,
  validateExtendedKey
} from '@/utils/validation'

bitcoinjs.initEccLib(ecc)

function isBitcoinTransaction(data: string): boolean {
  try {
    const processedData = stripBitcoinPrefix(data.trim())
    bitcoinjs.Transaction.fromHex(processedData)
    return true
  } catch {
    return false
  }
}

export type ContentType =
  | 'bitcoin_address'
  | 'bitcoin_uri'
  | 'psbt'
  | 'bitcoin_transaction'
  | 'lightning_invoice'
  | 'lnurl'
  | 'ecash_token'
  | 'bbqr_fragment'
  | 'seed_qr'
  | 'ur'
  | 'bitcoin_descriptor'
  | 'extended_public_key'
  | 'incompatible'
  | 'unknown'

export type DetectedContent = {
  type: ContentType
  raw: string
  cleaned: string
  metadata?: Record<string, unknown>
  isValid: boolean
}

function isExtendedPublicKey(data: string): boolean {
  return validateExtendedKey(data)
}

async function detectBitcoinContent(
  data: string
): Promise<DetectedContent | null> {
  const trimmed = data.trim()

  const descriptorValidation = await validateDescriptorFormat(trimmed)
  if (descriptorValidation) {
    return {
      cleaned: trimmed,
      isValid: true,
      metadata: {
        isCombined: isCombinedDescriptor(trimmed)
      },
      raw: data,
      type: 'bitcoin_descriptor'
    }
  }

  if (isPSBT(trimmed)) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'psbt'
    }
  }

  // Check for transaction
  const transactionData = stripBitcoinPrefix(trimmed)
  if (isBitcoinTransaction(transactionData)) {
    return {
      cleaned: transactionData,
      isValid: true,
      raw: data,
      type: 'bitcoin_transaction'
    }
  }

  if (isExtendedPublicKey(trimmed)) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'extended_public_key'
    }
  }

  if (isBitcoinUri(trimmed)) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'bitcoin_uri'
    }
  }

  if (trimmed.toLowerCase().startsWith('bitcoin:')) {
    const uriPart = trimmed.substring(8)
    if (isBitcoinUri(trimmed)) {
      return {
        cleaned: trimmed,
        isValid: true,
        raw: data,
        type: 'bitcoin_uri'
      }
    }
    const addressMatch = uriPart.match(/^([^?]+)(\?.*)?$/)
    if (addressMatch && isBitcoinAddress(addressMatch[1])) {
      return {
        cleaned: trimmed,
        isValid: true,
        raw: data,
        type: 'bitcoin_uri'
      }
    }
  }

  if (isBitcoinAddress(trimmed)) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'bitcoin_address'
    }
  }

  const addressMatch = trimmed.match(/^([a-zA-Z0-9]{26,62})(\?.*)?$/)
  if (addressMatch) {
    const [, addressPart] = addressMatch
    if (isBitcoinAddress(addressPart)) {
      return {
        cleaned: trimmed,
        isValid: true,
        raw: data,
        type: 'bitcoin_uri'
      }
    }
  }

  return null
}

function detectLightningContent(data: string): DetectedContent | null {
  const trimmed = data.trim()
  const lowerTrimmed = trimmed.toLowerCase()

  // Check for BOLT11 invoices using bip-321 validation
  // This handles all networks: mainnet (lnbc), testnet (lntb), regtest (lnbcrt), signet (lntbs)
  if (
    lowerTrimmed.startsWith('lnbc') ||
    lowerTrimmed.startsWith('lntb') ||
    lowerTrimmed.startsWith('lnbcrt') ||
    lowerTrimmed.startsWith('lntbs')
  ) {
    const validation = validateLightning(lowerTrimmed)
    if (validation.isValid) {
      return {
        cleaned: trimmed,
        isValid: true,
        metadata: {
          network: validation.appNetwork
        },
        raw: data,
        type: 'lightning_invoice'
      }
    }
    // Even if validation fails, still detect as lightning invoice
    // to allow the user to see the content type
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'lightning_invoice'
    }
  }

  // Check for BOLT12 offers (lno prefix)
  if (lowerTrimmed.startsWith('lno')) {
    const validation = validateBolt12(lowerTrimmed)
    return {
      cleaned: trimmed,
      isValid: validation.isValid,
      metadata: {
        isBolt12: true,
        isValid: validation.isValid
      },
      raw: data,
      type: 'lightning_invoice'
    }
  }

  if (isLNURL(lowerTrimmed)) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'lnurl'
    }
  }

  return null
}

function detectEcashContent(data: string): DetectedContent | null {
  const trimmed = data.trim()

  if (trimmed.startsWith('cashuA') || trimmed.startsWith('cashuB')) {
    try {
      const decoded = getDecodedToken(trimmed)
      if (decoded) {
        return {
          cleaned: trimmed,
          isValid: true,
          metadata: {
            mint: decoded.mint,
            proofs: decoded.proofs?.length || 0,
            version: trimmed.startsWith('cashuA') ? 'v3' : 'v4'
          },
          raw: data,
          type: 'ecash_token'
        }
      }
    } catch {
      const isV4 = trimmed.startsWith('cashuB')
      return {
        cleaned: trimmed,
        // v4 often needs keysets to decode (short keyset ID, key type); treat as valid when format is v4
        isValid: isV4,
        metadata: { version: isV4 ? 'v4' : 'v3' },
        raw: data,
        type: 'ecash_token'
      }
    }
  }

  return null
}

function detectImportContent(data: string): DetectedContent | null {
  const trimmed = data.trim()

  if (isBBQRFragment(trimmed)) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'bbqr_fragment'
    }
  }

  if (trimmed.toLowerCase().startsWith('ur:crypto-psbt/')) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'ur'
    }
  }

  const decodedSeed = detectAndDecodeSeedQR(trimmed)
  if (decodedSeed) {
    return {
      cleaned: trimmed,
      isValid: true,
      metadata: {
        mnemonic: decodedSeed
      },
      raw: data,
      type: 'seed_qr'
    }
  }

  return null
}

export async function detectContentByContext(
  data: string,
  context: 'bitcoin' | 'lightning' | 'ecash'
): Promise<DetectedContent> {
  if (!data || data.trim().length === 0) {
    return {
      cleaned: data,
      isValid: false,
      raw: data,
      type: 'unknown'
    }
  }

  let detected: DetectedContent | null = null

  switch (context) {
    case 'bitcoin':
      detected = await detectBitcoinContent(data)
      if (!detected) {
        detected = detectLightningContent(data) || detectEcashContent(data)
        if (detected) {
          detected.type = 'incompatible'
        }
      }
      break
    case 'lightning':
      detected = detectLightningContent(data)
      if (!detected) {
        detected =
          (await detectBitcoinContent(data)) || detectEcashContent(data)
        if (detected) {
          detected.type = 'incompatible'
        }
      }
      break
    case 'ecash':
      detected = detectEcashContent(data) || detectLightningContent(data)
      if (!detected) {
        detected = await detectBitcoinContent(data)
        if (detected) {
          detected.type = 'incompatible'
        }
      }
      break
    default:
      break
  }

  if (!detected) {
    detected = detectImportContent(data)
  }

  if (!detected) {
    return {
      cleaned: data.trim(),
      isValid: false,
      raw: data,
      type: 'unknown'
    }
  }

  return detected
}

export function isContentTypeSupportedInContext(
  contentType: ContentType,
  context: 'bitcoin' | 'lightning' | 'ecash'
): boolean {
  switch (context) {
    case 'bitcoin':
      return [
        'bitcoin_address',
        'bitcoin_uri',
        'psbt',
        'bitcoin_descriptor',
        'extended_public_key'
      ].includes(contentType)
    case 'lightning':
      return ['lightning_invoice', 'lnurl'].includes(contentType)
    case 'ecash':
      return ['ecash_token', 'lightning_invoice', 'lnurl'].includes(contentType)
    default:
      return false
  }
}

export function getContentTypeDescription(contentType: ContentType): string {
  switch (contentType) {
    case 'bitcoin_address':
      return 'Bitcoin Address'
    case 'bitcoin_uri':
      return 'Bitcoin Payment Request'
    case 'psbt':
      return 'Partially Signed Bitcoin Transaction'
    case 'bitcoin_descriptor':
      return 'Bitcoin Descriptor'
    case 'extended_public_key':
      return 'Extended Public Key'
    case 'incompatible':
      return 'Incompatible Content'
    case 'lightning_invoice':
      return 'Lightning Network Invoice'
    case 'lnurl':
      return 'LNURL Payment Request'
    case 'ecash_token':
      return 'Ecash Token'
    case 'bbqr_fragment':
      return 'BBQR Fragment'
    case 'seed_qr':
      return 'Seed Phrase QR Code'
    case 'ur':
      return 'Universal Resource'
    case 'unknown':
      return 'Unknown Content'
    default:
      return 'Unknown Content'
  }
}
