import { getDefaultWordlist, wordlists } from 'bip39'

function getWordList() {
  const name = getDefaultWordlist()
  return wordlists[name]
}

export { getWordList }
