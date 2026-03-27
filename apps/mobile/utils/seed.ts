import { type Secret } from '@/types/models/Account'
import { randomNum } from '@/utils/crypto'

/**
 * Returns a shuffled 3 word list that contains the correct seed word
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
      seedWordsArray[Math.floor(randomNum() * seedWordsArray.length)]
    if (!candidates.includes(newCandidate)) {
      candidates.push(newCandidate)
    }
  }

  let currentIndex = candidates.length
  let randomIndex: number

  while (currentIndex > 0) {
    randomIndex = Math.floor(randomNum() * currentIndex)
    currentIndex--
    ;[candidates[currentIndex], candidates[randomIndex]] = [
      candidates[randomIndex],
      candidates[currentIndex]
    ]
  }

  return candidates
}

export { getConfirmWordCandidates }
