import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type ScriptVersionType } from '@/types/models/Script'
import { parseLabel } from '@/utils/parse'

export function normalizeAddressSet(addresses: Iterable<string>): Set<string> {
  const set = new Set<string>()
  for (const address of addresses) {
    const normalized = address.trim()
    if (normalized) {
      set.add(normalized)
    }
  }
  return set
}

export function getAccountAddressSets(accountAddresses: Account['addresses']) {
  const ownAddresses = new Set<string>()
  const internalAddresses = new Set<string>()

  for (const entry of accountAddresses) {
    const normalized = entry.address.trim()
    if (!normalized) {
      continue
    }
    ownAddresses.add(normalized)
    if (entry.keychain === 'internal') {
      internalAddresses.add(normalized)
    }
  }

  return { internalAddresses, ownAddresses }
}

export function isChangeOutputLabel(label: string): boolean {
  const { label: parsed } = parseLabel(label || '')
  const lower = parsed.toLowerCase().trim()
  const defaultChange = t('sign.changeAddressLabelDefault').toLowerCase()

  return (
    lower === defaultChange ||
    lower.startsWith('[change]') ||
    lower.includes('[change for]')
  )
}

export function isChangeOutputAddress(
  address: string,
  internalAddresses: Set<string>
): boolean {
  const normalized = address.trim()
  return normalized !== '' && internalAddresses.has(normalized)
}

export function getScriptVersionType(
  address: string
): ScriptVersionType | null {
  const isBase58 = /^[1-9A-HJ-NP-Za-km-z]+$/.test(address)
  const isBech32 = /^(bc1|tb1)[0-9a-z]+$/.test(address.toLowerCase())

  if (!isBase58 && !isBech32) {
    return null
  }

  if (isBase58 && !isBech32) {
    switch (address[0]) {
      case '1':
      case 'm':
      case 'n':
        return 'P2PKH'
      case '3':
      case '2':
        return 'P2SH'
      default:
        return null
    }
  }

  const prefix = address.toLowerCase().startsWith('bc1') ? 'bc1' : 'tb1'
  const data = address.toLowerCase().slice(prefix.length)

  switch (data[0]) {
    case 'p':
      return 'P2TR'
    case 'q':
      if (address.length >= 42 && address.length <= 44) {
        return 'P2WPKH'
      }
      if (address.length >= 60 && address.length <= 62) {
        return 'P2WSH'
      }
      break
    default:
      break
  }

  return null
}
