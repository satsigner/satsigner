import ecc from '@bitcoinerlab/secp256k1'
import { KeychainKind, Network } from 'bdk-rn/lib/lib/enums'
import { BIP32Factory } from 'bip32'

import type { ScriptVersionType } from '@/types/models/Account'
import {
  getDerivationPathFromScriptVersion,
  getMultisigDerivationPathFromScriptVersion
} from '@/utils/bitcoin'

// TODO: import from bip32 instead of declaring it (currently giving error)
type BIP32Network = {
  wif: number
  bip32: {
    public: number
    private: number
  }
  messagePrefix?: string
  bech32?: string
  pubKeyHash?: number
  scriptHash?: number
}

const bip32 = BIP32Factory(ecc)

const networkMap: Record<Network, BIP32Network> = {
  [Network.Bitcoin]: {
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    wif: 0x80
  },
  [Network.Testnet]: {
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    wif: 0xef
  },
  [Network.Regtest]: {
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    wif: 0xef
  },
  [Network.Signet]: {
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    wif: 0xef
  }
}

export function getStandardPath(
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  network: Network,
  account = 0
) {
  const purpose = getScriptVersionPurpose(scriptVersion)
  const coinType = network === Network.Bitcoin ? 0 : 1
  const change = kind === KeychainKind.External ? 0 : 1
  const path = `m/${purpose}'/${coinType}'/${account}'/${change}/*`
  return path
}

export function getDescriptorFromSeed(
  seed: Buffer,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  network: Network,
  account = 0
): string {
  const masterKey = bip32.fromSeed(seed, networkMap[network])
  const path = getStandardPath(scriptVersion, kind, network, account)
  const derivedKey = masterKey.derivePath(path.replace('*', '0'))
  const pubkey = Buffer.from(derivedKey.publicKey).toString('hex')
  const descriptor = getDescriptorFromPubkey(pubkey, scriptVersion)
  return `${descriptor}[${path}]`
}

export function getDescriptorFromPubkey(
  pubkey: string,
  scriptVersion: ScriptVersionType
) {
  switch (scriptVersion) {
    case 'P2PKH':
      return `pkh(${pubkey})`
    case 'P2WPKH':
      return `wpkh(${pubkey})`
    case 'P2SH-P2WPKH':
      return `sh(wpkh(${pubkey}))`
    case 'P2TR':
      return `tr(${pubkey})`
    case 'P2WSH':
      return `wsh(pk(${pubkey}))`
    case 'P2SH-P2WSH':
      return `sh(wsh(pk(${pubkey})))`
    case 'P2SH':
      return `sh(pk(${pubkey}))`
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

export function getFingerprintFromSeed(seed: Buffer, network: Network) {
  const masterKey = bip32.fromSeed(seed, networkMap[network])
  const fingerprint = Buffer.from(masterKey.fingerprint).toString('hex')
  return fingerprint
}

export function getFingerprintFromExtendedPublicKey(
  extendedPublicKey: string,
  network: Network
) {
  const masterKey = bip32.fromBase58(extendedPublicKey, networkMap[network])
  const fingerprint = Buffer.from(masterKey.fingerprint).toString('hex')
  return fingerprint
}

export function getExtendedPublicKeyFromSeed(
  seed: Buffer,
  network: Network,
  scriptVersion: ScriptVersionType
) {
  const masterKey = bip32.fromSeed(seed, networkMap[network])
  // this assumes default account=0 and external address kind=0
  const path = getStandardPath(scriptVersion, KeychainKind.External, network, 0)
  const derivedKey = masterKey.derivePath(path.replace('*', '0'))
  return derivedKey.toBase58()
}

export function getExtendedKeyFromDescriptor(descriptor: string) {
  const match = descriptor.match(/(tpub|xpub|vpub|zpub)[A-Za-z0-9]+/)
  return match ? match[0] : ''
}

export function getDescriptorsFromKey(
  extendedPublicKey: string,
  fingerprint: string,
  scriptVersion: ScriptVersionType,
  network: Network,
  isMultisig = false
) {
  // Convert BDK Network to blockchain Network type
  const blockchainNetwork =
    network === Network.Bitcoin
      ? 'bitcoin'
      : network === Network.Testnet
        ? 'testnet'
        : 'signet'

  // Use the correct derivation path based on account type
  const derivationPath = isMultisig
    ? getMultisigDerivationPathFromScriptVersion(
        scriptVersion,
        blockchainNetwork
      )
    : getDerivationPathFromScriptVersion(scriptVersion, blockchainNetwork)

  // Construct the key part with fingerprint and derivation path
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
    default:
      externalDescriptor = `wpkh(${keyPart}/0/*)`
      internalDescriptor = `wpkh(${keyPart}/1/*)`
  }

  // TODO: add checksum

  // Return descriptors without checksum if BDK fails
  return {
    externalDescriptor,
    internalDescriptor
  }
}
