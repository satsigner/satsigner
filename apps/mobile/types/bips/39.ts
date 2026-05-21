import chineseSimplified from 'bip39/src/wordlists/chinese_simplified.json'
import chineseTraditional from 'bip39/src/wordlists/chinese_traditional.json'
import czech from 'bip39/src/wordlists/czech.json'
import english from 'bip39/src/wordlists/english.json'
import french from 'bip39/src/wordlists/french.json'
import italian from 'bip39/src/wordlists/italian.json'
import japanese from 'bip39/src/wordlists/japanese.json'
import korean from 'bip39/src/wordlists/korean.json'
import portuguese from 'bip39/src/wordlists/portuguese.json'
import spanish from 'bip39/src/wordlists/spanish.json'
import { Language, WordCount } from 'react-native-bdk-sdk'
import z from 'zod'

export const MnemonicWordCountSchema = z.union([
  z.literal(12),
  z.literal(15),
  z.literal(18),
  z.literal(21),
  z.literal(24)
])

export const MnemonicEntropyBitsSchema = z.union([
  z.literal(128),
  z.literal(160),
  z.literal(192),
  z.literal(224),
  z.literal(256)
])

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

export const DEFAULT_WORD_LIST: WordListName = 'english'

export const WORDLISTS: Record<WordListName, string[]> = {
  chinese_simplified: chineseSimplified,
  chinese_traditional: chineseTraditional,
  czech,
  english,
  french,
  italian,
  japanese,
  korean,
  portuguese,
  spanish
}

export const WordListNameSchema = z.enum(WORDLIST_LIST)

export const LANGUAGE_MAP: Record<WordListName, Language> = {
  chinese_simplified: Language.SimplifiedChinese,
  chinese_traditional: Language.TraditionalChinese,
  czech: Language.Czech,
  english: Language.English,
  french: Language.French,
  italian: Language.Italian,
  japanese: Language.Japanese,
  korean: Language.Korean,
  portuguese: Language.Portuguese,
  spanish: Language.Spanish
}

export const WORD_COUNT_MAP: Record<MnemonicWordCount, WordCount> = {
  12: WordCount.Words12,
  15: WordCount.Words15,
  18: WordCount.Words18,
  21: WordCount.Words21,
  24: WordCount.Words24
}

export const WORD_COUNT_TO_ENTROPY_BYTES: Record<MnemonicWordCount, number> = {
  12: 16,
  15: 20,
  18: 24,
  21: 28,
  24: 32
}

export type MnemonicEntropyBits = z.infer<typeof MnemonicEntropyBitsSchema>
export type MnemonicWordCount = z.infer<typeof MnemonicWordCountSchema>
export type WordListName = (typeof WORDLIST_LIST)[number]
