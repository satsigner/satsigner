import { Buffer } from 'buffer'

import { decodeBBQRChunks } from '@/utils/bbqr'
import { isBitcoinAddress } from '@/utils/bitcoin'

const PSBT_MAGIC_HEX = '70736274'
const PSBT_MAGIC_BASE64 = 'cHNidP'

const WALLET_TEXT_PATTERN =
  /(?:^|[\s"(])(?:wpkh\(|wsh\(|tr\(|sh\(|pkh\(|combo\(|multi\(|sortedmulti\(|addr\(|rawtr\(|\[(?:[0-9a-fA-F]{8})\/|[tuvxyz]pub)/i

export function looksLikeWalletText(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  if (trimmed.startsWith('{') && trimmed.includes('"descriptor"')) {
    return true
  }
  if (isBitcoinAddress(trimmed)) {
    return true
  }
  return WALLET_TEXT_PATTERN.test(trimmed)
}

export function interpretBinaryWalletPayload(bytes: Uint8Array): string {
  const utf8 = Buffer.from(bytes).toString('utf8')
  if (looksLikeWalletText(utf8)) {
    return utf8.trim()
  }

  const hex = Buffer.from(bytes).toString('hex')
  if (hex.toLowerCase().startsWith(PSBT_MAGIC_HEX)) {
    return hex
  }

  if (utf8.startsWith(PSBT_MAGIC_BASE64)) {
    return Buffer.from(utf8, 'base64').toString('hex')
  }

  return hex
}

export function decodeBBQRWalletPayload(chunks: string[]): string | null {
  const decoded = decodeBBQRChunks(chunks)
  if (!decoded) {
    return null
  }
  return interpretBinaryWalletPayload(decoded)
}

export function interpretAssembledBitcoinPayload(assembled: string): string {
  const trimmed = assembled.trim()
  if (looksLikeWalletText(trimmed)) {
    return trimmed
  }
  if (trimmed.startsWith(PSBT_MAGIC_BASE64)) {
    return Buffer.from(trimmed, 'base64').toString('hex')
  }
  try {
    return Buffer.from(assembled, 'base64').toString('hex')
  } catch {
    return assembled
  }
}
