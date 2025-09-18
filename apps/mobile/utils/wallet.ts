import type { KeychainKind, Network } from 'bdk-rn/lib/lib/enums'
import * as bip39 from 'bip39'

import type {
  Key,
  MnemonicEntropyBits,
  MnemonicWordCount,
  Secret
} from '@/types/models/Account'

const wordCountToEntropyBits: Record<MnemonicWordCount, MnemonicEntropyBits> = {
  12: 128,
  15: 160,
  18: 192,
  21: 224,
  24: 256
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
  mnemonic: NonNullable<Secret['mnemonic']>,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  kind: KeychainKind,
  passphrase: Secret['passphrase'],
  network: Network
) {
  // TODO: implement it
}

export function getFingerprintFromMnemonic(
  mnemonic: NonNullable<Secret['mnemonic']>,
  passphrase: Secret['passphrase'],
  network: Network
) {
  // TODO: implement it
}
