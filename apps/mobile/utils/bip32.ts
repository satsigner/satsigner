import ecc from '@bitcoinerlab/secp256k1'
import { KeychainKind, Network } from 'bdk-rn/lib/lib/enums'
import { BIP32Factory } from 'bip32'

import type { ScriptVersionType } from '@/types/models/Account'

// TODO: import this interface from bip32 package (currently gives error)
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

export function getDescriptorFromSeed(
  seed: Buffer,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  network: Network,
  account = 0
): string {
  const masterKey = bip32.fromSeed(seed, networkMap[network])
  const purpose = getScriptVersionPurpose(scriptVersion)
  const coinType = network === Network.Bitcoin ? 0 : 1
  const change = kind === KeychainKind.External ? 0 : 1
  const path = `m/${purpose}'/${coinType}'/${account}'/${change}/*`
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
    default:
      throw new Error(`Unsupported script version: ${scriptVersion}`)
  }
}

export function getFingerprintFromSeed(seed: Buffer, network: Network) {
  const masterKey = bip32.fromSeed(seed, networkMap[network])
  const fingerprint = Buffer.from(masterKey.fingerprint).toString('hex')
  return fingerprint
}
