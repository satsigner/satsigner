import type { KeychainKind, Network } from 'bdk-rn/lib/lib/enums'
import * as bip39 from 'bip39'

import type { Key, Secret } from '@/types/models/Account'

export function generateMnemonic(wordList = 'english') {
  return bip39.generateMnemonic(undefined, undefined, bip39.wordlists[wordList])
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
