import { isPSBT } from '@/utils/bitcoinContent'

/** Normalize hex or base64 PSBT payload to base64 (`cHNidP…`). */
export function normalizePsbtToBase64(input: string): string | null {
  const trimmed = input.trim().replace(/\s+/g, '')
  if (!trimmed || !isPSBT(trimmed)) {
    return null
  }
  if (trimmed.startsWith('cHNidP')) {
    return trimmed
  }
  try {
    return Buffer.from(trimmed, 'hex').toString('base64')
  } catch {
    return null
  }
}
