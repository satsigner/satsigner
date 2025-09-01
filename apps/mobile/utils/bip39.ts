import { getDefaultWordlist, wordlists } from 'bip39'

type WordListName =
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

const defaultWorldList = getDefaultWordlist() as WordListName

function getWordList(name: WordListName = defaultWorldList) {
  return wordlists[name]
}

export { getWordList }
