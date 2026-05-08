import { type Secret } from '@/types/models/Account'
import { randomNum } from '@/utils/crypto'

/**
 * Returns a shuffled 3 word list that contains the correct seed word
 */
function getConfirmWordCandidates(
  currentWord: string,
  seedWords: NonNullable<Secret['mnemonic']>
) {
  const seedWordsArray = seedWords.split(' ')
  const uniqueSeedWords = Array.from(new Set(seedWordsArray))

  if (!currentWord || uniqueSeedWords.length < 3) {
    return [currentWord, '', ''].slice(0, 3)
  }

  const candidates: string[] = []
  candidates.push(currentWord)

  while (candidates.length < 3) {
    const newCandidate =
      seedWordsArray[Math.floor(randomNum() * seedWordsArray.length)]
    if (!candidates.includes(newCandidate)) {
      candidates.push(newCandidate)
    }
  }

  let currentIndex = candidates.length
  let randomIndex: number

  while (currentIndex > 0) {
    randomIndex = Math.floor(randomNum() * currentIndex)
    currentIndex -= 1
    ;[candidates[currentIndex], candidates[randomIndex]] = [
      candidates[randomIndex],
      candidates[currentIndex]
    ]
  }

  return candidates
}

export { getConfirmWordCandidates }
