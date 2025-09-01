import { getDefaultWordlist, wordlists } from 'bip39'

type WordList =
  | 'chinese_simplified'
  | 'chinese_traditional'
  | 'czech'
  | 'english'
  | 'french'
  | 'italian'
  | 'japanese'
  | 'korean'
  | 'portuguese'
  | 'spanish'

const WORDLIST_LIST: WordList[] = [
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
]

const DEFAULT_WORD_LIST = getDefaultWordlist() as WordList

function getWordList(name: WordList = DEFAULT_WORD_LIST) {
  return wordlists[name]
}

export { DEFAULT_WORD_LIST, getWordList, type WordList, WORDLIST_LIST }
