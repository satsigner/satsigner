import { type ScriptVersionType } from '@/types/models/Account'

export function getScriptVersionType(
  address: string
): ScriptVersionType | null {
  const isBase58 = /^[1-9A-HJ-NP-Za-km-z]+$/.test(address)
  const isBech32 = /^(bc1|tb1)[0-9a-z]+$/.test(address.toLowerCase())

  if (!isBase58 && !isBech32) return null

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
      if (address.length >= 42 && address.length <= 44) return 'P2WPKH'
      if (address.length >= 60 && address.length <= 62) return 'P2WSH'
      break
    default:
      break
  }

  return null
}
