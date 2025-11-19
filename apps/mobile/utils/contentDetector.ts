import { getDecodedToken } from '@cashu/cashu-ts'

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

/**
 * Check if a string is a raw Bitcoin transaction in hex format
 */
function isBitcoinTransaction(data: string): boolean {
  const trimmed = data.trim()

  // Bitcoin transactions are hex strings with even length
  if (!/^[0-9a-fA-F]+$/.test(trimmed)) return false
  if (trimmed.length % 2 !== 0) return false

  // Bitcoin transactions are typically between 200-1000 bytes (400-2000 hex chars)
  // But we'll be more lenient to catch edge cases
  if (trimmed.length < 100 || trimmed.length > 10000) return false

  // Check if it starts with version bytes (typically 01000000 for version 1)
  // This is a good heuristic for Bitcoin transactions
  const versionBytes = trimmed.substring(0, 8)
  if (
    versionBytes === '01000000' ||
    versionBytes === '02000000' ||
    versionBytes === '00000000'
  ) {
    return true
  }

  // Additional check: look for common Bitcoin transaction patterns
  // Most transactions have input count and output count in the first few bytes
  try {
    const firstByte = parseInt(trimmed.substring(8, 10), 16)
    if (firstByte >= 1 && firstByte <= 20) {
      // Reasonable input count
      return true
    }
  } catch {
    return false
  }

  return false
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

async function isBitcoinDescriptor(data: string): Promise<boolean> {
  if (data.length < 10 || data.length > 1024) {
    return false
  }

  const prefixes = [
    'pk',
    'pkh',
    'wpkh',
    'sh',
    'wsh',
    'tr',
    'multi',
    'sortedmulti',
    'addr',
    'combo'
  ]
  const startsWithPrefix = prefixes.some((prefix) =>
    data.trim().toLowerCase().startsWith(prefix)
  )
  if (!startsWithPrefix) {
    return false
  }

  try {
    const result = await validateDescriptorFormat(data)
    return result.isValid
  } catch {
    return false
  }
}

/**
 * Detect Bitcoin-related content (addresses, URIs, PSBTs)
 */
async function detectBitcoinContent(
  data: string
): Promise<DetectedContent | null> {
  const trimmed = data.trim()

  // Check for Bitcoin descriptor
  if (await isBitcoinDescriptor(trimmed)) {
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

  // Check for PSBT
  if (isPSBT(trimmed)) {
    return {
      type: 'psbt',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  // Check for raw Bitcoin transaction (hex format)
  if (isBitcoinTransaction(trimmed)) {
    return {
      type: 'bitcoin_transaction',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  // Check for extended public key
  if (isExtendedPublicKey(trimmed)) {
    return {
      type: 'extended_public_key',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  // Check for BIP21 URI
  if (isBip21(trimmed)) {
    return {
      type: 'bitcoin_uri',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  // Check for bitcoin: URI (remove prefix and check address)
  if (trimmed.toLowerCase().startsWith('bitcoin:')) {
    const addressPart = trimmed.substring(8)
    if (isBitcoinAddress(addressPart)) {
      return {
        type: 'bitcoin_uri',
        raw: data,
        cleaned: trimmed,
        isValid: true
      }
    }
  }

  // Check for Bitcoin address (with or without query parameters)
  // First try the full string, then try extracting just the address part
  if (isBitcoinAddress(trimmed)) {
    return {
      type: 'bitcoin_address',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  // Check if it's an address with query parameters (like amount, label, etc.)
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

/**
 * Detect Lightning Network content (invoices, LNURLs)
 */
function detectLightningContent(data: string): DetectedContent | null {
  const trimmed = data.trim().toLowerCase()

  // Check for Lightning invoice (lnbc, lntb, lnbcrt)
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

  // Check for LNURL
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

/**
 * Detect ecash tokens (v3 and v4 formats)
 */
function detectEcashContent(data: string): DetectedContent | null {
  const trimmed = data.trim()

  // Check for ecash token patterns
  if (trimmed.startsWith('cashuA') || trimmed.startsWith('cashuB')) {
    try {
      // Validate token structure using Cashu library
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
      // Token format detected but invalid structure
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

/**
 * Detect import-related content (seeds, descriptors, BBQR, UR)
 */
async function detectImportContent(
  data: string
): Promise<DetectedContent | null> {
  const trimmed = data.trim()

  // Check for BBQR fragment
  if (isBBQRFragment(trimmed)) {
    return {
      type: 'bbqr_fragment',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  // Check for UR (Universal Resource)
  if (trimmed.toLowerCase().startsWith('ur:crypto-psbt/')) {
    return {
      type: 'ur',
      raw: data,
      cleaned: trimmed,
      isValid: true
    }
  }

  // Check for seed QR
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

/**
 * Main entry point for content detection by context
 */
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

  // Try context-specific detection first
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

  // If context-specific detection failed, try import content detection
  if (!detected) {
    detected = await detectImportContent(data)
  }

  // If still no detection, return unknown
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

/**
 * Check if content type is supported in the given context
 */
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

/**
 * Get user-friendly description for content type
 */
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
