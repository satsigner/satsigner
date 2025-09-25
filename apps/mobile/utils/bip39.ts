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

const WORDLIST_LIST = [
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

type WordList = (typeof WORDLIST_LIST)[number]

const DEFAULT_WORD_LIST = bip39.getDefaultWordlist() as WordList

function getWordList(name: WordList = DEFAULT_WORD_LIST) {
  return bip39.wordlists[name]
}

function convertMnemonicUsingIndexes(
  mnemonic: string,
  target: WordList,
  source: WordList = 'english'
) {
  // we can expect app users to use english as the default word list, and not
  // other languages, in which case the target and source lists will often be
  // the same, not needing conversion.
  if (target === source) return mnemonic

  const words = mnemonic.split(' ')
  const sourceWordList = bip39.wordlists[source]
  const targetWordList = bip39.wordlists[target]

  // build a lookup table for faster index lookup
  const indexLookupTable: Record<string, number> = sourceWordList.reduce(
    (previousValue, word, index) => {
      return {
        ...previousValue,
        [word]: index
      }
    },
    {}
  )

  // collect the word indexes
  const indexes = words.map((word) => indexLookupTable[word])

  if (indexes.includes(-1)) {
    throw new Error(
      `Mnemonic "${mnemonic}" contains words not found in the ${source} word list.`
    )
  }

  const convertedWords = indexes.map((index) => targetWordList[index])
  const convertedMnemonic = convertedWords.join(' ')
  return convertedMnemonic
}

function convertMnemonicUsingEntropy(
  mnemonic: string,
  target: WordList,
  source: WordList = 'english'
) {
  if (target === source) return mnemonic
  const sourceWordList = bip39.wordlists[source]
  const targetWordList = bip39.wordlists[target]
  const entropy = bip39.mnemonicToEntropy(mnemonic, sourceWordList)
  const targetMnemonic = bip39.entropyToMnemonic(entropy, targetWordList)
  return targetMnemonic
}

const convertMnemonic = convertMnemonicUsingEntropy

const wordCountToEntropyBits: Record<MnemonicWordCount, MnemonicEntropyBits> = {
  12: 128,
  15: 160,
  18: 192,
  21: 224,
  24: 256
}

export function getWordList() {
  const name = bip39.getDefaultWordlist()
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

export {
  convertMnemonic,
  convertMnemonicUsingEntropy,
  convertMnemonicUsingIndexes,
  DEFAULT_WORD_LIST,
  getWordList,
  type WordList,
  WORDLIST_LIST
}