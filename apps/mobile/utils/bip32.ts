import ecc from '@bitcoinerlab/secp256k1'
import { KeychainKind, Network as BDKNetwork } from 'bdk-rn/lib/lib/enums'
import { BIP32Factory, type BIP32Interface } from 'bip32'

import type { ScriptVersionType } from '@/types/models/Account'
import { type Network as AppNetwork } from '@/types/settings/blockchain'
import {
  getDerivationPathFromScriptVersion,
  getMultisigDerivationPathFromScriptVersion
} from '@/utils/bitcoin'

const bip32 = BIP32Factory(ecc)

/*

BIP-32 define codes and prefixes to extended key for master keys in HD wallets,
which vary by network (mainnet, testnet, signet, regtest).

Network | Extended Private Key Prefix | Extended Public Key Prefix | Hex Prefix (Private) | Hex Prefix (Public)
Mainnet | xprv                        | xpub                       | 0x0488ADE4           | 0x0488B21E
Testnet | tprv                        | tpub                       | 0x043587CF           | 0x0435B243
Signet  | tprv                        | tpub                       | 0x043587CF           | 0x0435B243
Regtest | tprv                        | tpub                       | 0x043587CF           | 0x0435B243

We need to convert BDK Network enum type to the type used by BIP32Interface.

*/

const BIP32Networks: Record<BDKNetwork, BIP32Interface['network']> = {
  [BDKNetwork.Bitcoin]: {
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    wif: 0x80
  },
  [BDKNetwork.Testnet]: {
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    wif: 0xef
  },
  [BDKNetwork.Regtest]: {
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    wif: 0xef
  },
  [BDKNetwork.Signet]: {
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    wif: 0xef
  }
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

export function getDescriptorFromSeed(
  seed: Buffer,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  network: BDKNetwork
): string {
  const masterKey = bip32.fromSeed(seed, BIP32Networks[network])
  const path = getStandardPath(scriptVersion, network)
  const derivedKey = masterKey.derivePath(`m/${path}`)
  const pubkey = Buffer.from(derivedKey.publicKey).toString('hex')
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

export function getFingerprintFromSeed(seed: Buffer, network: BDKNetwork) {
  const masterKey = bip32.fromSeed(seed, BIP32Networks[network])
  const fingerprint = Buffer.from(masterKey.fingerprint).toString('hex')
  return fingerprint
}

export function getFingerprintFromExtendedPublicKey(
  extendedPublicKey: string,
  network: BDKNetwork
) {
  const masterKey = bip32.fromBase58(extendedPublicKey, BIP32Networks[network])
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
