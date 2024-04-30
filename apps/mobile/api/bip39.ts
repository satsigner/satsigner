import {
  getDefaultWordlist,
  validateMnemonic as bip39ValidateMnemonic,
  wordlists
} from 'bip39'

import { type Account } from '@/types/models/Account'

function getWordList() {
  const name = getDefaultWordlist()
  return wordlists[name]
}

function validateMnemonic(seedWords: NonNullable<Account['seedWords']>) {
  return bip39ValidateMnemonic(seedWords.join(' '))
}

export { getWordList, validateMnemonic }
