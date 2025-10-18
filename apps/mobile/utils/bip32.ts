import ecc from '@bitcoinerlab/secp256k1'
import { HDKey } from '@scure/bip32' // TODO: remove @scure
import * as bip39 from '@scure/bip39' // TODO: remove @scure
import { KeychainKind, Network as BDKNetwork } from 'bdk-rn/lib/lib/enums'
import { BIP32Factory, type BIP32Interface } from 'bip32'

import type { ScriptVersionType } from '@/types/models/Account'
import { type Network as AppNetwork } from '@/types/settings/blockchain'
import {
  getDerivationPathFromScriptVersion,
  getMultisigDerivationPathFromScriptVersion
} from '@/utils/bitcoin'

// HD key versions for different networks
const VERSIONS = {
  mainnet: { public: 0x0488b21e, private: 0x0488ade4 },
  testnet: { public: 0x043587cf, private: 0x04358394 }
}

const bip32 = BIP32Factory(ecc)

/*

BIP-32 define codes and prefixes to extended key for master keys in HD wallets,
which vary by network (mainnet, testnet, signet, regtest).

We need to convert BDK Network enum type to the type used by BIP32Interface.

*/

const BIP32NetworkMainnet: BIP32Interface['network'] = {
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4
  },
  wif: 0x80
}

const BIP32NetworkTestnet: BIP32Interface['network'] = {
  bip32: {
    public: 0x043587cf,
    private: 0x04358394
  },
  wif: 0xef
}

const BIP32Networks: Record<BDKNetwork, BIP32Interface['network']> = {
  [BDKNetwork.Bitcoin]: BIP32NetworkMainnet,
  [BDKNetwork.Regtest]: BIP32NetworkTestnet,
  [BDKNetwork.Signet]: BIP32NetworkTestnet,
  [BDKNetwork.Testnet]: BIP32NetworkTestnet
}

export function getStandardPath(
  scriptVersion: ScriptVersionType,
  network: BDKNetwork,
  isMultiSig = false
) {
  const appNetwork = network as AppNetwork
  return isMultiSig
    ? getMultisigDerivationPathFromScriptVersion(scriptVersion, appNetwork)
    : getDerivationPathFromScriptVersion(scriptVersion, appNetwork)
}

export function getPublicDescriptorFromSeed(
  seed: Buffer,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  network: BDKNetwork
): string {
  const masterKey = bip32.fromSeed(seed, BIP32Networks[network])
  const path = getStandardPath(scriptVersion, network)
  const derivedKey = masterKey.derivePath(`m/${path}`)
  const pubkey = derivedKey.neutered().toBase58()
  const fingerprint = Buffer.from(masterKey.fingerprint).toString('hex')
  const descriptor = getDescriptorFromPubkey(
    pubkey,
    scriptVersion,
    fingerprint,
    path,
    kind
  )
  return descriptor
}

export function getPrivateDescriptorFromSeed(
  seed: Buffer,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  network: BDKNetwork
): string {
  const masterKey = bip32.fromSeed(seed, BIP32Networks[network])
  const path = getStandardPath(scriptVersion, network)
  const privateKey = masterKey.toBase58()
  const descriptor = getDescriptorFromPrivateKey(
    privateKey,
    scriptVersion,
    path,
    kind
  )
  return descriptor
}

export function getDescriptorFromPubkey(
  pubkey: string,
  scriptVersion: ScriptVersionType,
  fingerprint: string,
  path: string,
  kind: KeychainKind
) {
  const change = kind === KeychainKind.External ? 0 : 1
  const innerPart = `[${fingerprint}/${path}]${pubkey}/${change}/*`
  switch (scriptVersion) {
    case 'P2PKH':
      return `pkh(${innerPart})`
    case 'P2WPKH':
      return `wpkh(${innerPart})`
    case 'P2SH-P2WPKH':
      return `sh(wpkh(${innerPart}))`
    case 'P2TR':
      return `tr(${innerPart})`
    case 'P2WSH':
      return `wsh(pk(${innerPart}))`
    case 'P2SH-P2WSH':
      return `sh(wsh(pk(${innerPart})))`
    case 'P2SH':
      return `sh(pk(${innerPart}))`
  }
}

export function getDescriptorFromPrivateKey(
  pubkey: string,
  scriptVersion: ScriptVersionType,
  path: string,
  kind: KeychainKind
) {
  const change = kind === KeychainKind.External ? 0 : 1
  const innerPart = `${pubkey}/${path}/${change}/*`
  switch (scriptVersion) {
    case 'P2PKH':
      return `pkh(${innerPart})`
    case 'P2WPKH':
      return `wpkh(${innerPart})`
    case 'P2SH-P2WPKH':
      return `sh(wpkh(${innerPart}))`
    case 'P2TR':
      return `tr(${innerPart})`
    case 'P2WSH':
      return `wsh(pk(${innerPart}))`
    case 'P2SH-P2WSH':
      return `sh(wsh(pk(${innerPart})))`
    case 'P2SH':
      return `sh(pk(${innerPart}))`
  }
}

export function getScriptVersionPurpose(
  scriptVersion: ScriptVersionType
): number {
  switch (scriptVersion) {
    case 'P2PKH':
      return 44 // Legacy
    case 'P2SH-P2WPKH':
      return 49 // Nested SegWit
    case 'P2WPKH':
      return 84 // Native SegWit
    case 'P2TR':
      return 86 // Taproot
    case 'P2WSH':
    case 'P2SH-P2WSH':
    case 'P2SH':
      return 44 // Use legacy for these
  }
}

export function getFingerprintFromSeed(seed: Buffer) {
  // the master fingerprint does not depend upon network
  const masterKey = bip32.fromSeed(seed)
  const fingerprint = Buffer.from(masterKey.fingerprint).toString('hex')
  return fingerprint
}

export function getFingerprintFromExtendedPublicKey(extendedPublicKey: string) {
  // the master fingerprint does not depend upon network
  const masterKey = bip32.fromBase58(extendedPublicKey)
  const fingerprint = Buffer.from(masterKey.fingerprint).toString('hex')
  return fingerprint
}

export function getExtendedPublicKeyFromSeed(
  seed: Buffer,
  network: BDKNetwork,
  scriptVersion: ScriptVersionType
) {
  const masterKey = bip32.fromSeed(seed, BIP32Networks[network])
  // this assumes default account=0 and external address kind=0
  const path = getStandardPath(scriptVersion, network)
  const derivedKey = masterKey.derivePath(path).neutered()
  return derivedKey.toBase58()
}

// TODO: use @bitcoinerlab/descriptors and place it on utils/descriptors
export function getExtendedKeyFromDescriptor(descriptor: string) {
  const match = descriptor.match(/([xyztuv]pub)[A-Za-z0-9]+/)
  return match ? match[0] : ''
}

// TODO: use @bitcoinerlab/descriptors and place it on utils/descriptors
export function getDescriptorsFromKey(
  extendedPublicKey: string,
  fingerprint: string,
  scriptVersion: ScriptVersionType,
  network: BDKNetwork,
  isMultisig = false
) {
  const derivationPath = getStandardPath(scriptVersion, network, isMultisig)
  const keyPart = `[${fingerprint}/${derivationPath}]${extendedPublicKey}`

  let externalDescriptor = ''
  let internalDescriptor = ''

  // Generate descriptors based on script version
  switch (scriptVersion) {
    case 'P2PKH':
      externalDescriptor = `pkh(${keyPart}/0/*)`
      internalDescriptor = `pkh(${keyPart}/1/*)`
      break
    case 'P2SH-P2WPKH':
      externalDescriptor = `sh(wpkh(${keyPart}/0/*))`
      internalDescriptor = `sh(wpkh(${keyPart}/1/*))`
      break
    case 'P2WPKH':
      externalDescriptor = `wpkh(${keyPart}/0/*)`
      internalDescriptor = `wpkh(${keyPart}/1/*)`
      break
    case 'P2TR':
      externalDescriptor = `tr(${keyPart}/0/*)`
      internalDescriptor = `tr(${keyPart}/1/*)`
      break
    case 'P2WSH':
      externalDescriptor = `wsh(${keyPart}/0/*)`
      internalDescriptor = `wsh(${keyPart}/1/*)`
      break
    case 'P2SH-P2WSH':
      externalDescriptor = `sh(wsh(${keyPart}/0/*))`
      internalDescriptor = `sh(wsh(${keyPart}/1/*))`
      break
    case 'P2SH':
      externalDescriptor = `sh(${keyPart}/0/*)`
      internalDescriptor = `sh(${keyPart}/1/*)`
      break
  }

  // TODO: add checksum while keeping it sinchronous

  return {
    externalDescriptor,
    internalDescriptor
  }
}

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
