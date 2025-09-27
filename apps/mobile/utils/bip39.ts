import type { KeychainKind, Network } from 'bdk-rn/lib/lib/enums'
import * as bip39 from 'bip39'

import type {
  MnemonicEntropyBits,
  MnemonicWordCount,
  ScriptVersionType,
  Secret
} from '@/types/models/Account'
import {
  getDescriptorFromSeed,
  getExtendedPublicKeyFromSeed,
  getFingerprintFromSeed
} from '@/utils/bip32'

export const WORDLIST_LIST = [
  'chinese_simplified',
  'chinese_traditional',
  'czech',
  'english',
  'french',
  'italian',
  'japanese',
  'korean',
  'portuguese',
  'spanish'
] as const

export type WordListName = (typeof WORDLIST_LIST)[number]

export const DEFAULT_WORD_LIST = bip39.getDefaultWordlist() as WordListName

const wordCountToEntropyBits: Record<MnemonicWordCount, MnemonicEntropyBits> = {
  12: 128,
  15: 160,
  18: 192,
  21: 224,
  24: 256
}

export function getWordList(name: WordListName = DEFAULT_WORD_LIST) {
  return bip39.wordlists[name]
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
  wordListName: string = 'english'
) {
  if (entropy.length < 128 || entropy.length > 256)
    throw new Error('Invalid Entropy: it must be range of [128, 256]')
  if (entropy.length % 32 !== 0)
    throw new Error('Invalid Entropy: it must be divisible by 32')
  const wordlist = bip39.wordlists[wordListName]
  return bip39.entropyToMnemonic(entropy, wordlist)
}

export function getDescriptorFromMnemonic(
  mnemonic: string,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  passphrase: string | undefined,
  network: Network,
  account = 0
): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
  return getDescriptorFromSeed(seed, scriptVersion, kind, network, account)
}

export function getFingerprintFromMnemonic(
  mnemonic: NonNullable<Secret['mnemonic']>,
  passphrase: Secret['passphrase'],
  network: Network
) {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
  return getFingerprintFromSeed(seed, network)
}

export function getExtendedPublicKeyFromMnemonic(
  mnemonic: string,
  passphrase: string = '',
  network: Network,
  scriptVersion: ScriptVersionType
) {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
  return getExtendedPublicKeyFromSeed(seed, network, scriptVersion)
}
