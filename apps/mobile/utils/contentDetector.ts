import ecc from '@bitcoinerlab/secp256k1'
import { getDecodedToken } from '@cashu/cashu-ts'
import * as bitcoinjs from 'bitcoinjs-lib'

import { isBBQRFragment } from '@/utils/bbqr'
import { isBip21, isBitcoinAddress } from '@/utils/bitcoin'
import { isPSBT } from '@/utils/bitcoinContent'
import { isLNURL } from '@/utils/lnurl'
import { detectAndDecodeSeedQR } from '@/utils/seedqr'
import {
  isCombinedDescriptor,
  validateDescriptorFormat,
  validateExtendedKey
} from '@/utils/validation'

bitcoinjs.initEccLib(ecc)

function isBitcoinTransaction(data: string): boolean {
  try {
    let processedData = data.trim()
    // Strip "bitcoin:" prefix if present (case-insensitive)
    if (processedData.toLowerCase().startsWith('bitcoin:')) {
      processedData = processedData.substring(8)
    }
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
  metadata?: Record<string, any>
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
      type: 'bitcoin_descriptor',
      raw: data,
      cleaned: trimmed,
      isValid: true,
      metadata: {
        isCombined: isCombinedDescriptor(trimmed)
      }
    }
  }

  if (isPSBT(trimmed)) {
    return {
      type: 'psbt',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  // Check for transaction (strip "bitcoin:" prefix if present)
  let transactionData = trimmed
  if (transactionData.toLowerCase().startsWith('bitcoin:')) {
    transactionData = transactionData.substring(8)
  }
  if (isBitcoinTransaction(transactionData)) {
    return {
      type: 'bitcoin_transaction',
      raw: data,
      cleaned: transactionData,
      isValid: true
    }
  }

  if (isExtendedPublicKey(trimmed)) {
    return {
      type: 'extended_public_key',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  if (isBip21(trimmed)) {
    return {
      type: 'bitcoin_uri',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  if (trimmed.toLowerCase().startsWith('bitcoin:')) {
    const uriPart = trimmed.substring(8)
    if (isBip21(trimmed)) {
      return {
        type: 'bitcoin_uri',
        raw: data,
        cleaned: trimmed,
        isValid: true
      }
    }
    const addressMatch = uriPart.match(/^([^?]+)(\?.*)?$/)
    if (addressMatch && isBitcoinAddress(addressMatch[1])) {
      return {
        type: 'bitcoin_uri',
        raw: data,
        cleaned: trimmed,
        isValid: true
      }
    }
  }

  if (isBitcoinAddress(trimmed)) {
    return {
      type: 'bitcoin_address',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  const addressMatch = trimmed.match(/^([a-zA-Z0-9]{26,62})(\?.*)?$/)
  if (addressMatch) {
    const addressPart = addressMatch[1]
    if (isBitcoinAddress(addressPart)) {
      return {
        type: 'bitcoin_uri',
        raw: data,
        cleaned: trimmed,
        isValid: true
      }
    }
  }

  return null
}

function detectLightningContent(data: string): DetectedContent | null {
  const trimmed = data.trim().toLowerCase()

  if (
    trimmed.startsWith('lnbc') ||
    trimmed.startsWith('lntb') ||
    trimmed.startsWith('lnbcrt')
  ) {
    return {
      type: 'lightning_invoice',
      raw: data,
      cleaned: data.trim(),
      isValid: true
    }
  }

  if (isLNURL(trimmed)) {
    return {
      type: 'lnurl',
      raw: data,
      cleaned: data.trim(),
      isValid: true
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
          type: 'ecash_token',
          raw: data,
          cleaned: trimmed,
          metadata: {
            version: trimmed.startsWith('cashuA') ? 'v3' : 'v4',
            mint: decoded.mint,
            proofs: decoded.proofs?.length || 0
          },
          isValid: true
        }
      }
    } catch {
      return {
        type: 'ecash_token',
        raw: data,
        cleaned: trimmed,
        isValid: false
      }
    }
  }

  return null
}

async function detectImportContent(
  data: string
): Promise<DetectedContent | null> {
  const trimmed = data.trim()

  if (isBBQRFragment(trimmed)) {
    return {
      type: 'bbqr_fragment',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  if (trimmed.toLowerCase().startsWith('ur:crypto-psbt/')) {
    return {
      type: 'ur',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  const decodedSeed = detectAndDecodeSeedQR(trimmed)
  if (decodedSeed) {
    return {
      type: 'seed_qr',
      raw: data,
      cleaned: trimmed,
      metadata: {
        mnemonic: decodedSeed
      },
      isValid: true
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
      type: 'unknown',
      raw: data,
      cleaned: data,
      isValid: false
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
  }

  if (!detected) {
    detected = await detectImportContent(data)
  }

  if (!detected) {
    return {
      type: 'unknown',
      raw: data,
      cleaned: data.trim(),
      isValid: false
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
