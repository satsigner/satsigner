import type { Network } from '@/types/settings/blockchain'

export function getBolt11Network(invoice: string): Network | null {
  const trimmed = invoice.trim().toLowerCase()
  if (trimmed.startsWith('lnbcrt')) {
    return null
  }
  if (trimmed.startsWith('lntbs')) {
    return 'signet'
  }
  if (trimmed.startsWith('lntb')) {
    return 'testnet'
  }
  if (trimmed.startsWith('lnbc')) {
    return 'bitcoin'
  }
  return null
}
