import { HDKey } from '@scure/bip32'
import * as bip39 from '@scure/bip39'
import { decode } from 'bip21'
import { networks } from 'bitcoinjs-lib'
import bs58check from 'bs58check'

import { type ScriptVersionType } from '@/types/models/Account'
import { type Network } from '@/types/settings/blockchain'

// HD key versions for different networks
const VERSIONS = {
  mainnet: { public: 0x0488b21e, private: 0x0488ade4 },
  testnet: { public: 0x043587cf, private: 0x04358394 }
}

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
// to the network interface used by bitcoinjs-lib
function bitcoinjsNetwork(network: Network): networks.Network {
  switch (network) {
    case 'bitcoin':
      return networks['bitcoin']
    case 'signet':
      return networks['testnet']
    case 'testnet':
      return networks['testnet']
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
    xpub: 'tpub', // Can be used for P2PKH, P2WPKH, P2SH-P2WPKH depending on derivation path
    ypub: 'upub', // P2SH-P2WPKH
    zpub: 'vpub', // P2WPKH
    vpub: 'vpub' // P2TR
  },
  signet: {
    xpub: 'tpub', // Can be used for P2PKH, P2WPKH, P2SH-P2WPKH depending on derivation path
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
  } catch (_error) {
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
    P2TR: 'vpub',
    P2WSH: 'xpub', // P2WSH uses xpub format
    'P2SH-P2WSH': 'xpub', // P2SH-P2WSH uses xpub format
    P2SH: 'xpub' // P2SH uses xpub format
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
  // Note: For testnet, tpub can be used for different script types
  // The script type should be determined by the derivation path, not just the prefix
  const scriptVersionMap: Record<string, string> = {
    xpub: 'P2PKH',
    ypub: 'P2SH-P2WPKH',
    upub: 'P2SH-P2WPKH',
    zpub: 'P2WPKH',
    vpub: 'P2WPKH'
    // Note: tpub is not included here because it can be used for different script types
    // The script type should be determined by the derivation path, not just the prefix
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
    case 'P2WSH':
      return `48'/${coinType}'/0'/2'`
    case 'P2SH-P2WSH':
      return `48'/${coinType}'/0'/1'`
    case 'P2SH':
      return `45'/${coinType}'/0'`
    default:
      return `84'/${coinType}'/0'`
  }
}

/**
 * Get the appropriate derivation path for multisig accounts based on script version and network
 * This follows the multisig descriptor policy for different script types
 */
export function getMultisigDerivationPathFromScriptVersion(
  scriptVersion: string,
  network: Network
): string {
  // Determine coin type based on network
  const coinType = network === 'bitcoin' ? '0' : '1'

  switch (scriptVersion) {
    case 'P2PKH':
      // For multisig P2PKH, use P2SH derivation path (m/45'/0'/0')
      return `45'/${coinType}'/0'`
    case 'P2SH-P2WPKH':
      // For multisig P2SH-P2WPKH, use P2SH-P2WSH derivation path (m/48'/0'/0'/1')
      return `48'/${coinType}'/0'/1'`
    case 'P2WPKH':
      // For multisig P2WPKH, use P2WSH derivation path (m/48'/0'/0'/2')
      return `48'/${coinType}'/0'/2'`
    case 'P2TR':
      // For multisig P2TR, use P2TR derivation path (m/86'/0'/0')
      return `86'/${coinType}'/0'`
    case 'P2WSH':
      // Native SegWit multisig (m/48'/0'/0'/2')
      return `48'/${coinType}'/0'/2'`
    case 'P2SH-P2WSH':
      // Wrapped SegWit multisig (m/48'/0'/0'/1')
      return `48'/${coinType}'/0'/1'`
    case 'P2SH':
      return `45'/${coinType}'/0'`
    default:
      // Default to P2WSH for multisig (m/48'/0'/0'/2')
      return `48'/${coinType}'/0'/2'`
  }
}

/**
 * Map script version to the corresponding multisig script type for descriptor generation
 * This ensures that the correct multisig descriptor type is used based on the script version
 */
export function getMultisigScriptTypeFromScriptVersion(
  scriptVersion: string
): string {
  switch (scriptVersion) {
    case 'P2PKH':
      // For multisig P2PKH, use P2SH descriptor
      return 'P2SH'
    case 'P2SH-P2WPKH':
      // For multisig P2SH-P2WPKH, use P2SH-P2WSH descriptor
      return 'P2SH-P2WSH'
    case 'P2WPKH':
      // For multisig P2WPKH, use P2WSH descriptor
      return 'P2WSH'
    case 'P2TR':
      // For multisig P2TR, use P2TR descriptor
      return 'P2TR'
    case 'P2WSH':
      // Native SegWit multisig
      return 'P2WSH'
    case 'P2SH-P2WSH':
      // Wrapped SegWit multisig
      return 'P2SH-P2WSH'
    case 'P2SH':
      return 'P2SH'
    default:
      // Default to P2WSH for multisig
      return 'P2WSH'
  }
}

/**
 * Get P2SH extended public key from seed
 */
function getP2SHXpub(seed: Uint8Array, network: 'mainnet' | 'testnet'): string {
  const versions = getVersionsForNetwork(network)
  const master = HDKey.fromMasterSeed(seed, versions)

  // Derive m/45' for P2SH
  const node = master.deriveChild(0x80000000 + 45)

  return node.publicExtendedKey
}

/**
 * Get P2SH-P2WSH extended public key from seed
 */
function getP2SHP2WSHXpub(
  seed: Uint8Array,
  network: 'mainnet' | 'testnet'
): string {
  const versions = getVersionsForNetwork(network)
  const master = HDKey.fromMasterSeed(seed, versions)

  // Derive m/48'/0'/0'/1' for mainnet, m/48'/1'/0'/1' for testnet
  const coinType = network === 'mainnet' ? 0 : 1
  const node = master
    .deriveChild(0x80000000 + 48)
    .deriveChild(0x80000000 + coinType)
    .deriveChild(0x80000000)
    .deriveChild(0x80000000 + 1)

  return node.publicExtendedKey
}

/**
 * Get P2WSH extended public key from seed
 */
function getP2WSHXpub(
  seed: Uint8Array,
  network: 'mainnet' | 'testnet'
): string {
  const versions = getVersionsForNetwork(network)
  const master = HDKey.fromMasterSeed(seed, versions)

  // Derive m/48'/0'/0'/2' for mainnet, m/48'/1'/0'/2' for testnet
  const coinType = network === 'mainnet' ? 0 : 1
  const node = master
    .deriveChild(0x80000000 + 48)
    .deriveChild(0x80000000 + coinType)
    .deriveChild(0x80000000)
    .deriveChild(0x80000000 + 2)

  return node.publicExtendedKey
}

function getP2WPKHXpub(
  seed: Uint8Array,
  network: 'mainnet' | 'testnet'
): string {
  // For multisig P2WPKH, use the same derivation path as P2WSH (BIP48)
  return getP2WSHXpub(seed, network)
}

function getP2PKHXpub(
  seed: Uint8Array,
  network: 'mainnet' | 'testnet'
): string {
  const versions = getVersionsForNetwork(network)
  const master = HDKey.fromMasterSeed(seed, versions)

  // Derive m/44'/0'/0' for mainnet, m/44'/1'/0' for testnet
  const coinType = network === 'mainnet' ? 0 : 1
  const node = master
    .deriveChild(0x80000000 + 44)
    .deriveChild(0x80000000 + coinType)
    .deriveChild(0x80000000)

  return node.publicExtendedKey
}

function getP2SHP2WPKHXpub(
  seed: Uint8Array,
  network: 'mainnet' | 'testnet'
): string {
  const versions = getVersionsForNetwork(network)
  const master = HDKey.fromMasterSeed(seed, versions)

  // Derive m/49'/0'/0' for mainnet, m/49'/1'/0' for testnet
  const coinType = network === 'mainnet' ? 0 : 1
  const node = master
    .deriveChild(0x80000000 + 49)
    .deriveChild(0x80000000 + coinType)
    .deriveChild(0x80000000)

  return node.publicExtendedKey
}

function getP2TRXpub(seed: Uint8Array, network: 'mainnet' | 'testnet'): string {
  const versions = getVersionsForNetwork(network)
  const master = HDKey.fromMasterSeed(seed, versions)

  // Derive m/86'/0'/0' for mainnet, m/86'/1'/0' for testnet
  const coinType = network === 'mainnet' ? 0 : 1
  const node = master
    .deriveChild(0x80000000 + 86)
    .deriveChild(0x80000000 + coinType)
    .deriveChild(0x80000000)

  return node.publicExtendedKey
}

/**
 * Convert a Uint8Array to hex string
 */
export function toHex(u8: Uint8Array | undefined): string {
  return Array.from(u8 || [])
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert a number to a zero-padded 4-byte hex string
 */
export function fingerprintToHex(fpNum: number): string {
  const buf = new Uint8Array(4)
  const dv = new DataView(buf.buffer)
  dv.setUint32(0, fpNum >>> 0) // ensure unsigned
  return toHex(buf)
}

/**
 * Get HD key versions for the specified network
 */
export function getVersionsForNetwork(network: 'mainnet' | 'testnet') {
  return VERSIONS[network]
}

/**
 * Get extended public key for specific script version
 */
export function getXpubForScriptVersion(
  mnemonic: string,
  passphrase: string = '',
  scriptVersion: ScriptVersionType,
  network: 'mainnet' | 'testnet'
): string {
  // Validate that the script version is supported for multisig
  const supportedMultisigVersions: ScriptVersionType[] = [
    'P2SH',
    'P2SH-P2WSH',
    'P2WSH',
    'P2WPKH',
    'P2PKH',
    'P2SH-P2WPKH',
    'P2TR'
  ]

  if (!supportedMultisigVersions.includes(scriptVersion)) {
    throw new Error(
      `Script version "${scriptVersion}" is not supported for multisig accounts. ` +
        `Supported versions: ${supportedMultisigVersions.join(', ')}`
    )
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)

  // Map script versions to their corresponding xpub functions
  const xpubFunctions: Record<
    ScriptVersionType,
    (seed: Uint8Array, network: 'mainnet' | 'testnet') => string
  > = {
    P2SH: getP2SHXpub,
    'P2SH-P2WSH': getP2SHP2WSHXpub,
    P2WSH: getP2WSHXpub,
    P2WPKH: getP2WPKHXpub,
    P2PKH: getP2PKHXpub,
    'P2SH-P2WPKH': getP2SHP2WPKHXpub,
    P2TR: getP2TRXpub
  }

  return xpubFunctions[scriptVersion](seed, network)
}

/**
 * Get all three extended public keys from mnemonic
 */
export function getAllXpubs(
  mnemonic: string,
  passphrase: string = '',
  network: 'mainnet' | 'testnet'
) {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)

  return {
    p2sh: getP2SHXpub(seed, network),
    p2sh_p2wsh: getP2SHP2WSHXpub(seed, network),
    p2wsh: getP2WSHXpub(seed, network)
  }
}

export { bip21decode, bitcoinjsNetwork, isBip21, isBitcoinAddress }
