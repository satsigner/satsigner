import { getDecodedToken } from '@cashu/cashu-ts'

import { isBBQRFragment } from '@/utils/bbqr'
import { isBip21, isBitcoinAddress } from '@/utils/bitcoin'
import { isPSBT } from '@/utils/bitcoinContent'
import { isLNURL } from '@/utils/lnurl'
import { detectAndDecodeSeedQR } from '@/utils/seedqr'

export type ContentType =
  | 'bitcoin_address'
  | 'bitcoin_uri'
  | 'psbt'
  | 'lightning_invoice'
  | 'lnurl'
  | 'ecash_token'
  | 'bbqr_fragment'
  | 'seed_qr'
  | 'ur'
  | 'unknown'

export type DetectedContent = {
  type: ContentType
  raw: string
  cleaned: string
  metadata?: Record<string, any>
  isValid: boolean
}

/**
 * Detect Bitcoin-related content (addresses, URIs, PSBTs)
 */
function detectBitcoinContent(data: string): DetectedContent | null {
  const trimmed = data.trim()

  // Check for PSBT
  if (isPSBT(trimmed)) {
    return {
      type: 'psbt',
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
function detectImportContent(data: string): DetectedContent | null {
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
export function detectContentByContext(
  data: string,
  context: 'bitcoin' | 'lightning' | 'ecash'
): DetectedContent {
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
      detected = detectBitcoinContent(data)
      break
    case 'lightning':
      detected = detectLightningContent(data)
      break
    case 'ecash':
      detected = detectEcashContent(data)
      // Also check for lightning content in ecash context
      if (!detected) {
        detected = detectLightningContent(data)
      }
      break
  }

  // If context-specific detection failed, try import content detection
  if (!detected) {
    detected = detectImportContent(data)
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
      return ['bitcoin_address', 'bitcoin_uri', 'psbt'].includes(contentType)
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
