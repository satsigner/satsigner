import { decode } from 'bip21'

// from https://stackoverflow.com/questions/21683680/regex-to-match-bitcoin-addresses + slightly modified to support testnet addresses
function isBitcoinAddress(address: string): boolean {
  return /^(?:[13]{1}[a-km-zA-HJ-NP-Z1-9]{25,34}|(bc1|tb1)[a-z0-9]{39,59})$/i.test(
    address
  )
}

function bip21decode(uri?: string) {
  try {
    if (!uri) {
      throw new Error('No URI provided')
    }

    const lowercaseData = uri.toLowerCase()

    if (lowercaseData.startsWith('bitcoin:')) {
      return decode(lowercaseData)
    }

    const isAddressValid = isBitcoinAddress(lowercaseData)
    if (isAddressValid) {
      return lowercaseData
    }
  } catch (_error) {}
}

export { bip21decode, isBitcoinAddress }
