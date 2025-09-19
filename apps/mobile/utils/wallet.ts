import ecc from '@bitcoinerlab/secp256k1'
import { KeychainKind, Network } from 'bdk-rn/lib/lib/enums'
import { BIP32Factory } from 'bip32'
import * as bip39 from 'bip39'

import type {
  MnemonicEntropyBits,
  MnemonicWordCount,
  ScriptVersionType,
  Secret
} from '@/types/models/Account'

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

const wordCountToEntropyBits: Record<MnemonicWordCount, MnemonicEntropyBits> = {
  12: 128,
  15: 160,
  18: 192,
  21: 224,
  24: 256
}

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

export function validateMnemonic(
  mnemonic: string,
  wordListName: string = 'english'
) {
  const wordlist = bip39.wordlists[wordListName]
  return bip39.validateMnemonic(mnemonic, wordlist)
}

export function generateMnemonic(
  wordCount: MnemonicWordCount = 12,
  wordListName = 'english'
) {
  const entropyBits = wordCountToEntropyBits[wordCount]
  const wordlist = bip39.wordlists[wordListName]
  const mnemonic = bip39.generateMnemonic(entropyBits, undefined, wordlist)
  return mnemonic
}

export function generateMnemonicFromEntropy(
  entropy: string,
  wordList: string = 'english'
) {
  return bip39.entropyToMnemonic(entropy, bip39.wordlists[wordList])
}

export function getDescriptorFromMnemonic(
  mnemonic: string,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  network: Network,
  passphrase: string | undefined,
  account = 0
): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
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

export function getFingerprintFromMnemonic(
  mnemonic: NonNullable<Secret['mnemonic']>,
  passphrase: Secret['passphrase'],
  network: Network
) {
  // TODO: implement it
}
