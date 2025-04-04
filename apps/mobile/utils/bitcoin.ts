import { decode } from 'bip21'
import { networks } from 'bitcoinjs-lib'

import { type Network } from '@/types/settings/blockchain'

// from https://stackoverflow.com/questions/21683680/regex-to-match-bitcoin-addresses + slightly modified to support testnet addresses
function isBitcoinAddress(address: string): boolean {
  return /^(?:[13]{1}[a-km-zA-HJ-NP-Z1-9]{25,34}|(bc1|tb1)[a-z0-9]{39,59})$/i.test(
    address
  )
}

function isBip21(uri: string) {
  try {
    const result = decode(uri)
    if (!isBitcoinAddress(result.address)) return false
    return true
  } catch {
    return false
  }
}

function bip21decode(uri: string) {
  try {
    if (!uri) throw new Error('No URI provided')
    const lowercaseData = uri.toLowerCase()
    if (lowercaseData.startsWith('bitcoin:')) return decode(lowercaseData)
    const isAddressValid = isBitcoinAddress(lowercaseData)
    if (isAddressValid) return lowercaseData
  } catch (_error) {}
}

// Convert network notation used by our app (and by BDK enum too)
// too the network interface used by bitcoinjs-lib
function bitcoinjsNetwork(network: Network): networks.Network {
  switch (network) {
    case 'bitcoin':
      return networks['bitcoin']
    case 'signet':
      return networks['testnet']
    case 'testnet':
      return networks['regtest']
  }
}

export { bip21decode, bitcoinjsNetwork, isBip21, isBitcoinAddress }
