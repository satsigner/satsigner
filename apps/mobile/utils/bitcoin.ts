import ecc from '@bitcoinerlab/secp256k1'
import { address as bjsAddress, initEccLib, networks } from 'bitcoinjs-lib'
import bs58check from 'bs58check'
import { Network as BdkNetwork } from 'react-native-bdk-sdk'

import {
  BIP44_PURPOSE,
  BIP45_PURPOSE,
  BIP48_PURPOSE,
  BIP48_SCRIPT_TYPE_P2SH_P2WSH,
  BIP48_SCRIPT_TYPE_P2WSH,
  BIP49_PURPOSE,
  BIP84_PURPOSE,
  BIP86_PURPOSE
} from '@/constants/derivation'
import { Account, Key } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Network as AppNetwork } from '@/types/settings/blockchain'
import { isBitcoinUri, parseBitcoinUri } from '@/utils/bip321'

initEccLib(ecc)

export type AddressScriptType = 'p2pkh' | 'p2sh' | 'p2tr' | 'p2wpkh' | 'p2wsh'

/**
 * Classify an address by decoding its output script, rather than trusting
 * caller-supplied metadata (e.g. an arbitrary address pasted into the
 * explorer verify-message flow has no known ScriptVersionType).
 */
export function getScriptTypeFromAddress(
  address: string,
  network: AppNetwork
): AddressScriptType | null {
  try {
    const script = bjsAddress.toOutputScript(address, bitcoinjsNetwork(network))
    if (
      script.length === 25 &&
      script[0] === 0x76 &&
      script[1] === 0xa9 &&
      script[23] === 0x88 &&
      script[24] === 0xac
    ) {
      return 'p2pkh'
    }
    if (script.length === 23 && script[0] === 0xa9 && script[22] === 0x87) {
      return 'p2sh'
    }
    if (script.length === 22 && script[0] === 0x00 && script[1] === 0x14) {
      return 'p2wpkh'
    }
    if (script.length === 34 && script[0] === 0x00 && script[1] === 0x20) {
      return 'p2wsh'
    }
    if (script.length === 34 && script[0] === 0x51 && script[1] === 0x20) {
      return 'p2tr'
    }
    return null
  } catch {
    return null
  }
}

/** Convert app string network to BDK numeric Network enum */
export function appNetworkToBdkNetwork(network: AppNetwork): BdkNetwork {
  switch (network) {
    case 'bitcoin':
      return BdkNetwork.Bitcoin
    case 'signet':
      return BdkNetwork.Signet
    case 'testnet':
      return BdkNetwork.Testnet
    default:
      return BdkNetwork.Testnet
  }
}

// TODO: delete this and replace all of its references with bitcoinjs-lib,
// since it provides more reliable validation function
// from https://stackoverflow.com/questions/21683680/regex-to-match-bitcoin-addresses + slightly modified to support testnet and regtest
// bc1=mainnet, tb1=testnet, bcrt1=regtest (Bech32/Bech32m)
function isBitcoinAddress(address: string): boolean {
  return /^(?:[13]{1}[a-km-zA-HJ-NP-Z1-9]{25,34}|(bc1|tb1|bcrt1)[a-z0-9]{39,59})$/i.test(
    address
  )
}

function isBip21(uri: string): boolean {
  if (!uri) {
    return false
  }
  const trimmed = uri.trim()

  if (trimmed.toLowerCase().startsWith('bitcoin:')) {
    return isBitcoinUri(trimmed)
  }

  return isBitcoinAddress(trimmed)
}

type Bip21DecodeResult = {
  address: string
  options: {
    amount?: number
    label?: string
    message?: string
  }
}

function bip21decode(uri: string): Bip21DecodeResult | string | undefined {
  try {
    if (!uri) {
      return undefined
    }
    const trimmed = uri.trim()

    if (trimmed.toLowerCase().startsWith('bitcoin:')) {
      const parsed = parseBitcoinUri(trimmed)
      if (parsed.isValid) {
        return {
          address: parsed.address,
          options: {
            amount: parsed.amount,
            label: parsed.label,
            message: parsed.message
          }
        }
      }
      return undefined
    }

    if (isBitcoinAddress(trimmed)) {
      return trimmed
    }

    return undefined
  } catch {
    return undefined
  }
}

// Convert network notation used by our app (and by BDK enum too)
// to the network interface used by bitcoinjs-lib
export function bitcoinjsNetwork(network: AppNetwork): networks.Network {
  switch (network) {
    case 'bitcoin':
      return networks['bitcoin']
    case 'signet':
      return networks['testnet']
    case 'testnet':
      return networks['testnet']
    default:
      return networks['bitcoin']
  }
}

const WIF_COMPRESSED_FLAG = 0x01

/**
 * Encode a raw 32-byte private key (hex) as WIF, the standard human-facing
 * format shown by most wallets and tools (e.g. iancoleman.io/bip39) -
 * unlike raw hex, WIF embeds the network and a compressed-pubkey flag, so
 * two encodings of the same key look nothing alike.
 */
export function privateKeyHexToWif(
  privateKeyHex: string,
  network: AppNetwork
): string {
  const { wif } = bitcoinjsNetwork(network)
  const payload = Buffer.concat([
    Buffer.from([wif]),
    Buffer.from(privateKeyHex, 'hex'),
    Buffer.from([WIF_COMPRESSED_FLAG])
  ])
  return bs58check.encode(payload)
}

// TODO: refactor all vibe code below, which is duplicate of other utils.

// Define version bytes for different key formats and networks
const KEY_VERSION_BYTES = {
  tpub: new Uint8Array([0x04, 0x35, 0x87, 0xcf]),
  upub: new Uint8Array([0x04, 0x4a, 0x52, 0x62]),
  vpub_mainnet: new Uint8Array([0x04, 0x5f, 0x1c, 0xf6]),
  vpub_testnet: new Uint8Array([0x04, 0x5f, 0x1c, 0xf6]),
  xpub: new Uint8Array([0x04, 0x88, 0xb2, 0x1e]),
  ypub: new Uint8Array([0x04, 0x9d, 0x7c, 0xb2]),
  zpub: new Uint8Array([0x04, 0xb2, 0x47, 0x46])
}

// Define key format mappings for each network
const NETWORK_KEY_FORMATS: Record<AppNetwork, Record<string, string>> = {
  bitcoin: {
    vpub: 'vpub', // P2TR
    xpub: 'xpub', // Legacy P2PKH
    ypub: 'ypub', // P2SH-P2WPKH
    zpub: 'zpub' // P2WPKH
  },
  signet: {
    vpub: 'vpub', // P2TR
    xpub: 'tpub', // Can be used for P2PKH, P2WPKH, P2SH-P2WPKH depending on derivation path
    ypub: 'upub', // P2SH-P2WPKH
    zpub: 'vpub' // P2WPKH
  },
  testnet: {
    vpub: 'vpub', // P2TR
    xpub: 'tpub', // Can be used for P2PKH, P2WPKH, P2SH-P2WPKH depending on derivation path
    ypub: 'upub', // P2SH-P2WPKH
    zpub: 'vpub' // P2WPKH
  }
}

export function convertKeyFormat(
  key: string,
  targetFormat: string,
  network: AppNetwork
): string {
  if (!key || !targetFormat || !network) {
    return key
  }

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
  } catch {
    return key
  }
}

export function getKeyFormatForScriptVersion(
  scriptVersion: string,
  network: AppNetwork
): string {
  const formatMappings: Record<string, string> = {
    P2PKH: 'xpub',
    P2SH: 'xpub', // P2SH uses xpub format
    'P2SH-P2WPKH': 'ypub',
    'P2SH-P2WSH': 'xpub', // P2SH-P2WSH uses xpub format
    P2TR: 'vpub',
    P2WPKH: 'zpub',
    P2WSH: 'xpub' // P2WSH uses xpub format
  }

  const baseFormat = formatMappings[scriptVersion] || 'xpub'
  return NETWORK_KEY_FORMATS[network][baseFormat] || baseFormat
}

export function detectNetworkFromKey(key: string): AppNetwork | null {
  if (!key) {
    return null
  }

  const mainnetPrefixes = ['xpub', 'ypub', 'zpub']
  const testnetPrefixes = ['tpub', 'upub', 'vpub']

  const prefix = key.match(/^[tuvxyz](pub|prv)/)?.[0]

  if (!prefix) {
    return null
  }

  if (mainnetPrefixes.includes(prefix)) {
    return 'bitcoin'
  } else if (testnetPrefixes.includes(prefix)) {
    // Note: We can't distinguish between testnet and signet from key prefix alone
    // This would need additional context from the user or application state
    return 'testnet' // Default to testnet
  }

  return null
}

export function getDerivationPathFromScriptVersion(
  scriptVersion: string,
  network: AppNetwork
): string {
  // Determine coin type based on network
  const coinType = network === 'bitcoin' ? '0' : '1'

  switch (scriptVersion) {
    case 'P2PKH':
      return `${BIP44_PURPOSE}'/${coinType}'/0'`
    case 'P2SH-P2WPKH':
      return `${BIP49_PURPOSE}'/${coinType}'/0'`
    case 'P2WPKH':
      return `${BIP84_PURPOSE}'/${coinType}'/0'`
    case 'P2TR':
      return `${BIP86_PURPOSE}'/${coinType}'/0'`
    case 'P2WSH':
      return `${BIP48_PURPOSE}'/${coinType}'/0'/${BIP48_SCRIPT_TYPE_P2WSH}'`
    case 'P2SH-P2WSH':
      return `${BIP48_PURPOSE}'/${coinType}'/0'/${BIP48_SCRIPT_TYPE_P2SH_P2WSH}'`
    case 'P2SH':
      return `${BIP45_PURPOSE}'/${coinType}'/0'`
    default:
      return `${BIP84_PURPOSE}'/${coinType}'/0'`
  }
}

export function getAccountDerivationPath(
  account: Account,
  keyIndex: Key['index'] = 0
) {
  if (!account.keys[keyIndex]) {
    return null
  }
  const { scriptVersion } = account.keys[keyIndex]
  if (!scriptVersion) {
    return null
  }
  const { network } = account
  return getDerivationPathFromScriptVersion(scriptVersion, network)
}

/**
 * Full derivation path for a specific address. Addresses built from BDK's
 * peekAddress() (see api/bdk.ts#getWalletAddresses) don't carry their own
 * derivationPath, so this reconstructs it from the account path plus the
 * change level (0=external, 1=internal) and index. IMPORTANT: the change
 * level must be included - `${accountPath}/${index}` alone derives a
 * completely different (wrong) key, since it's missing a whole path level.
 */
export function getAddressDerivationPath(
  account: Account,
  address: Pick<Address, 'derivationPath' | 'index' | 'keychain'>
): string {
  if (address.derivationPath) {
    return address.derivationPath
  }
  if (address.index === undefined || !address.keychain) {
    return ''
  }
  const accountPath = getAccountDerivationPath(account)
  if (!accountPath) {
    return ''
  }
  const change = address.keychain === 'internal' ? 1 : 0
  return `${accountPath}/${change}/${address.index}`
}

export function getMultisigDerivationPathFromScriptVersion(
  scriptVersion: string,
  network: AppNetwork
): string {
  // Determine coin type based on network
  const coinType = network === 'bitcoin' ? '0' : '1'

  switch (scriptVersion) {
    case 'P2PKH':
      // For multisig P2PKH, use P2SH derivation path (m/45'/0'/0')
      return `${BIP45_PURPOSE}'/${coinType}'/0'`
    case 'P2SH-P2WPKH':
      // For multisig P2SH-P2WPKH, use P2SH-P2WSH derivation path (m/48'/0'/0'/1')
      return `${BIP48_PURPOSE}'/${coinType}'/0'/${BIP48_SCRIPT_TYPE_P2SH_P2WSH}'`
    case 'P2WPKH':
      // For multisig P2WPKH, use P2WSH derivation path (m/48'/0'/0'/2')
      return `${BIP48_PURPOSE}'/${coinType}'/0'/${BIP48_SCRIPT_TYPE_P2WSH}'`
    case 'P2TR':
      // For multisig P2TR, use P2TR derivation path (m/86'/0'/0')
      return `${BIP86_PURPOSE}'/${coinType}'/0'`
    case 'P2WSH':
      // Native SegWit multisig (m/48'/0'/0'/2')
      return `${BIP48_PURPOSE}'/${coinType}'/0'/${BIP48_SCRIPT_TYPE_P2WSH}'`
    case 'P2SH-P2WSH':
      // Wrapped SegWit multisig (m/48'/0'/0'/1')
      return `${BIP48_PURPOSE}'/${coinType}'/0'/${BIP48_SCRIPT_TYPE_P2SH_P2WSH}'`
    case 'P2SH':
      return `${BIP45_PURPOSE}'/${coinType}'/0'`
    default:
      // Default to P2WSH for multisig (m/48'/0'/0'/2')
      return `${BIP48_PURPOSE}'/${coinType}'/0'/${BIP48_SCRIPT_TYPE_P2WSH}'`
  }
}

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

export { bip21decode, isBip21, isBitcoinAddress }
