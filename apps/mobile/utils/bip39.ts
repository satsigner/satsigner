import type { KeychainKind, Network } from 'bdk-rn/lib/lib/enums'
import * as bip39 from 'bip39'

import type {
  MnemonicEntropyBits,
  MnemonicWordCount,
  ScriptVersionType,
  Secret
} from '@/types/models/Account'
import { getDescriptorFromSeed, getFingerprintFromSeed } from '@/utils/bip32'

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
