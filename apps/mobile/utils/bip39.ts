import { getDefaultWordlist, wordlists } from 'bip39'

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

const DEFAULT_WORD_LIST = getDefaultWordlist() as WordList

function getWordList(name: WordList = DEFAULT_WORD_LIST) {
  return wordlists[name]
}

function convertMnemonic(
  mnemonic: string,
  target: WordList,
  source: WordList = 'english'
) {
  // we can expect app users to use english as the default word list, and not
  // other languages, in which case the target and source lists will often be
  // the same, not needing conversion.
  if (target === source) return mnemonic

  const words = mnemonic.split(' ')
  const sourceWordList = wordlists[source]
  const targetWordList = wordlists[target]

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

export {
  convertMnemonic,
  DEFAULT_WORD_LIST,
  getWordList,
  type WordList,
  WORDLIST_LIST
}
