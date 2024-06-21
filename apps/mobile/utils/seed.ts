import { type Account } from '@/types/models/Account'

/**
 * Returns a shuffled 3 word list that contains the correct seed word
 *
 * @param currentWord - The current seed word
 * @param seedWords - List of seed words
 * @returns A list with 3 candidate words
 */
function getConfirmWordCandidates(
  currentWord: string,
  seedWords: NonNullable<Account['seedWords']>
) {
  const candidates: string[] = []
  candidates.push(currentWord)

  while (candidates.length < 3) {
    const newCandidate = seedWords[Math.floor(Math.random() * seedWords.length)]
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

export { getConfirmWordCandidates }
