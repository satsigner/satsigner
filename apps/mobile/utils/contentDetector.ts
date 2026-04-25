import ecc from '@bitcoinerlab/secp256k1'
import { getDecodedToken } from '@cashu/cashu-ts'
import * as bitcoinjs from 'bitcoinjs-lib'

import { isBBQRFragment } from '@/utils/bbqr'
import {
  isBitcoinUri,
  isLightningAddress,
  validateArkAddressWithNetwork,
  validateBolt12,
  validateLightning
} from '@/utils/bip321'
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
  | 'lightning_address'
  | 'lnurl'
  | 'ark_address'
  | 'ecash_token'
  | 'bbqr_fragment'
  | 'seed_qr'
  | 'ur'
  | 'bitcoin_descriptor'
  | 'extended_public_key'
  | 'nostr_npub'
  | 'nostr_nsec'
  | 'nostr_note'
  | 'nostr_nevent'
  | 'nostr_nprofile'
  | 'nostr_connect'
  | 'nostr_json'
  | 'incompatible'
  | 'unknown'

export type ContentContext = 'bitcoin' | 'lightning' | 'ark' | 'ecash' | 'nostr'

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

function stripSchemePrefix(data: string): string {
  const lower = data.toLowerCase()
  if (lower.startsWith('web+cashu:')) {
    return data.slice(10)
  }
  if (lower.startsWith('lightning:')) {
    return data.slice(10)
  }
  if (lower.startsWith('cashu:')) {
    return data.slice(6)
  }
  return data
}

function detectArkContent(data: string): DetectedContent | null {
  const trimmed = data.trim()
  const validation = validateArkAddressWithNetwork(trimmed)
  if (!validation.isValid) {
    return null
  }
  return {
    cleaned: trimmed,
    isValid: true,
    metadata: {
      network: validation.network
    },
    raw: data,
    type: 'ark_address'
  }
}

function detectLightningContent(data: string): DetectedContent | null {
  const trimmed = stripSchemePrefix(data.trim())
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

  if (isLightningAddress(trimmed)) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'lightning_address'
    }
  }

  return null
}

function detectEcashContent(data: string): DetectedContent | null {
  const trimmed = stripSchemePrefix(data.trim())

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

function stripNostrPrefix(data: string): string {
  const lower = data.toLowerCase()
  if (lower.startsWith('nostr:')) {
    return data.slice(6)
  }
  return data
}

function detectNostrContent(data: string): DetectedContent | null {
  const trimmed = stripNostrPrefix(data.trim())
  const lower = trimmed.toLowerCase()

  if (lower.startsWith('nostrconnect://')) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'nostr_connect'
    }
  }

  if (lower.startsWith('npub1') && trimmed.length >= 60) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'nostr_npub'
    }
  }

  if (lower.startsWith('nsec1') && trimmed.length >= 60) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'nostr_nsec'
    }
  }

  if (lower.startsWith('note1') && trimmed.length >= 60) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'nostr_note'
    }
  }

  if (lower.startsWith('nevent1') && trimmed.length >= 60) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'nostr_nevent'
    }
  }

  if (lower.startsWith('nprofile1') && trimmed.length >= 60) {
    return {
      cleaned: trimmed,
      isValid: true,
      raw: data,
      type: 'nostr_nprofile'
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const kind = typeof parsed.kind === 'number' ? parsed.kind : 1
    if (kind !== 1 || typeof parsed.content !== 'string') {
      return null
    }
    if (
      parsed.tags !== undefined &&
      (!Array.isArray(parsed.tags) ||
        !parsed.tags.every(
          (tag) =>
            Array.isArray(tag) &&
            (tag as unknown[]).every((x) => typeof x === 'string')
        ))
    ) {
      return null
    }
    return {
      cleaned: trimmed,
      isValid: true,
      metadata: parsed,
      raw: data,
      type: 'nostr_json'
    }
  } catch {
    /* not JSON */
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
  context: ContentContext
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
    case 'ark':
      detected = detectArkContent(data) || detectLightningContent(data)
      if (!detected) {
        const bitcoinDetected = await detectBitcoinContent(data)
        if (bitcoinDetected?.type === 'bitcoin_uri') {
          // BIP-321 URI may embed a lightning or ark payment method
          // that the ark send flow can pay — keep it as a valid type.
          detected = bitcoinDetected
        } else if (bitcoinDetected) {
          bitcoinDetected.type = 'incompatible'
          detected = bitcoinDetected
        } else {
          detected = detectEcashContent(data)
          if (detected) {
            detected.type = 'incompatible'
          }
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
    case 'nostr':
      detected = detectNostrContent(data)
      if (!detected) {
        detected = detectLightningContent(data) || detectEcashContent(data)
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
  context: ContentContext
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
      return ['lightning_invoice', 'lnurl', 'lightning_address'].includes(
        contentType
      )
    case 'ark':
      return [
        'ark_address',
        'lightning_invoice',
        'lnurl',
        'lightning_address',
        'bitcoin_uri'
      ].includes(contentType)
    case 'ecash':
      return ['ecash_token', 'lightning_invoice', 'lnurl'].includes(contentType)
    case 'nostr':
      return [
        'nostr_connect',
        'nostr_npub',
        'nostr_nsec',
        'nostr_note',
        'nostr_nevent',
        'nostr_nprofile',
        'nostr_json'
      ].includes(contentType)
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
    case 'lightning_address':
      return 'Lightning Address'
    case 'lnurl':
      return 'LNURL Payment Request'
    case 'ark_address':
      return 'Ark Address'
    case 'ecash_token':
      return 'Ecash Token'
    case 'bbqr_fragment':
      return 'BBQR Fragment'
    case 'seed_qr':
      return 'Seed Phrase QR Code'
    case 'ur':
      return 'Universal Resource'
    case 'nostr_npub':
      return 'Nostr Public Key'
    case 'nostr_nsec':
      return 'Nostr Private Key'
    case 'nostr_note':
      return 'Nostr Note'
    case 'nostr_nevent':
      return 'Nostr Event'
    case 'nostr_nprofile':
      return 'Nostr Profile'
    case 'nostr_connect':
      return 'Nostr Connect Request'
    case 'nostr_json':
      return 'Nostr JSON Note'
    case 'unknown':
      return 'Unknown Content'
    default:
      return 'Unknown Content'
  }
}
