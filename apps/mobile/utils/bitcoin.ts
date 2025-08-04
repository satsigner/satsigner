import { decode } from 'bip21'
import { networks } from 'bitcoinjs-lib'
import bs58check from 'bs58check'

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

// Define version bytes for different key formats and networks
const KEY_VERSION_BYTES = {
  // Mainnet
  xpub: new Uint8Array([0x04, 0x88, 0xb2, 0x1e]),
  ypub: new Uint8Array([0x04, 0x9d, 0x7c, 0xb2]),
  zpub: new Uint8Array([0x04, 0xb2, 0x47, 0x46]),
  vpub_mainnet: new Uint8Array([0x04, 0x5f, 0x1c, 0xf6]),

  // Testnet/Signet
  tpub: new Uint8Array([0x04, 0x35, 0x87, 0xcf]),
  upub: new Uint8Array([0x04, 0x4a, 0x52, 0x62]),
  vpub_testnet: new Uint8Array([0x04, 0x5f, 0x1c, 0xf6])
}

// Define key format mappings for each network
const NETWORK_KEY_FORMATS: Record<Network, Record<string, string>> = {
  bitcoin: {
    xpub: 'xpub', // Legacy P2PKH
    ypub: 'ypub', // P2SH-P2WPKH
    zpub: 'zpub', // P2WPKH
    vpub: 'vpub' // P2TR
  },
  testnet: {
    xpub: 'tpub', // Legacy P2PKH
    ypub: 'upub', // P2SH-P2WPKH
    zpub: 'vpub', // P2WPKH
    vpub: 'vpub' // P2TR
  },
  signet: {
    xpub: 'tpub', // Legacy P2PKH
    ypub: 'upub', // P2SH-P2WPKH
    zpub: 'vpub', // P2WPKH
    vpub: 'vpub' // P2TR
  }
}

/**
 * Convert a key to the appropriate format for the given network
 */
export function convertKeyFormat(
  key: string,
  targetFormat: string,
  network: Network
): string {
  if (!key || !targetFormat || !network) return key

  try {
    const decoded = bs58check.decode(key)
    let version: Uint8Array

    // Determine the appropriate version bytes based on target format and network
    switch (targetFormat) {
      case 'xpub':
        version =
          network === 'bitcoin'
            ? KEY_VERSION_BYTES.xpub
            : KEY_VERSION_BYTES.tpub
        break
      case 'ypub':
        version =
          network === 'bitcoin'
            ? KEY_VERSION_BYTES.ypub
            : KEY_VERSION_BYTES.upub
        break
      case 'zpub':
        version =
          network === 'bitcoin'
            ? KEY_VERSION_BYTES.zpub
            : KEY_VERSION_BYTES.vpub_testnet
        break
      case 'vpub':
        version =
          network === 'bitcoin'
            ? KEY_VERSION_BYTES.vpub_mainnet
            : KEY_VERSION_BYTES.vpub_testnet
        break
      default:
        return key
    }

    // Create new decoded data with the target version
    const newDecoded = new Uint8Array([...version, ...decoded.slice(4)])
    return bs58check.encode(newDecoded)
  } catch (error) {
    console.error('Failed to convert key format:', error)
    return key
  }
}

/**
 * Get the appropriate key format for a given script version and network
 */
export function getKeyFormatForScriptVersion(
  scriptVersion: string,
  network: Network
): string {
  const formatMappings: Record<string, string> = {
    P2PKH: 'xpub',
    'P2SH-P2WPKH': 'ypub',
    P2WPKH: 'zpub',
    P2TR: 'vpub'
  }

  const baseFormat = formatMappings[scriptVersion] || 'xpub'
  return NETWORK_KEY_FORMATS[network][baseFormat] || baseFormat
}

/**
 * Detect the network from a key prefix
 */
export function detectNetworkFromKey(key: string): Network | null {
  if (!key) return null

  const mainnetPrefixes = ['xpub', 'ypub', 'zpub']
  const testnetPrefixes = ['tpub', 'upub', 'vpub']

  const prefix = key.match(/^[tuvxyz](pub|prv)/)?.[0]

  if (!prefix) return null

  if (mainnetPrefixes.includes(prefix)) {
    return 'bitcoin'
  } else if (testnetPrefixes.includes(prefix)) {
    // Note: We can't distinguish between testnet and signet from key prefix alone
    // This would need additional context from the user or application state
    return 'testnet' // Default to testnet
  }

  return null
}

/**
 * Convert a key to be compatible with the target network
 */
export function convertKeyForNetwork(
  key: string,
  targetNetwork: Network
): string {
  if (!key) return key

  const sourceNetwork = detectNetworkFromKey(key)
  if (!sourceNetwork || sourceNetwork === targetNetwork) return key

  // Extract the script version from the key prefix
  const scriptVersionMap: Record<string, string> = {
    xpub: 'P2PKH',
    tpub: 'P2PKH',
    ypub: 'P2SH-P2WPKH',
    upub: 'P2SH-P2WPKH',
    zpub: 'P2WPKH',
    vpub: 'P2WPKH'
  }

  const prefix = key.match(/^[tuvxyz](pub|prv)/)?.[0]
  if (!prefix) return key

  const scriptVersion = scriptVersionMap[prefix]
  if (!scriptVersion) return key

  // Get the appropriate format for the target network
  const targetFormat = getKeyFormatForScriptVersion(
    scriptVersion,
    targetNetwork
  )

  // Convert the key
  return convertKeyFormat(key, targetFormat, targetNetwork)
}

/**
 * Get the appropriate derivation path for a given script version and network
 */
export function getDerivationPathFromScriptVersion(
  scriptVersion: string,
  network: Network
): string {
  // Determine coin type based on network
  const coinType = network === 'bitcoin' ? '0' : '1'

  switch (scriptVersion) {
    case 'P2PKH':
      return `44'/${coinType}'/0'`
    case 'P2SH-P2WPKH':
      return `49'/${coinType}'/0'`
    case 'P2WPKH':
      return `84'/${coinType}'/0'`
    case 'P2TR':
      return `86'/${coinType}'/0'`
    default:
      return `84'/${coinType}'/0'`
  }
}

export { bip21decode, bitcoinjsNetwork, isBip21, isBitcoinAddress }
