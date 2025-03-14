import { type Secret } from '@/types/models/Account'

/**
 * Returns a shuffled 3 word list that contains the correct seed word
 *
 * @param currentWord - The current seed word
 * @param seedWords - String of seed words separated by space
 * @returns A list with 3 candidate words
 */
function getConfirmWordCandidates(
  currentWord: string,
  seedWords: NonNullable<Secret['mnemonic']>
) {
  const candidates: string[] = []
  candidates.push(currentWord)

  const seedWordsArray = seedWords.split(' ')

  while (candidates.length < 3) {
    const newCandidate =
      seedWordsArray[Math.floor(Math.random() * seedWordsArray.length)]
    if (!candidates.includes(newCandidate)) candidates.push(newCandidate)
  }

  let currentIndex = candidates.length
  let randomIndex: number

  while (currentIndex > 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    ;[candidates[currentIndex], candidates[randomIndex]] = [
      candidates[randomIndex],
      candidates[currentIndex]
    ]
  }

  return candidates
}

/*
 * List of words that are prefixed of another, pre-computed ahead of time.
 */
export const seedWordsPrefixOfAnother = {
  act: true,
  add: true,
  age: true,
  air: true,
  all: true,
  arm: true,
  art: true,
  bar: true,
  bus: true,
  can: true,
  car: true,
  cat: true,
  cry: true,
  cup: true,
  end: true,
  era: true,
  eye: true,
  fan: true,
  fat: true,
  fee: true,
  fit: true,
  fun: true,
  gas: true,
  ill: true,
  kid: true,
  kit: true,
  lab: true,
  law: true,
  leg: true,
  man: true,
  mix: true,
  mom: true,
  net: true,
  off: true,
  own: true,
  pen: true,
  pig: true,
  rib: true,
  run: true,
  sad: true,
  sea: true,
  ski: true,
  sun: true,
  ten: true,
  top: true,
  use: true,
  van: true,
  win: true,
  you: true
} as { [k: string]: boolean }

export { getConfirmWordCandidates }
