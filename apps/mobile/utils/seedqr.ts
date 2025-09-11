import { getWordList } from './bip39'

/**
 * Converts a mnemonic phrase to a standard SeedQR format
 * Each word is represented by its index (from the BIP39 word list), zero-padded to four digits
 */
export function encodeStandardSeedQR(mnemonic: string): string {
  const wordList = getWordList()
  const words = mnemonic.split(' ')
  return words
    .map((word) => {
      const index = wordList.indexOf(word)
      if (index === -1) throw new Error(`Invalid mnemonic word: ${word}`)
      return index.toString().padStart(4, '0')
    })
    .join('')
}

/**
 * Converts a mnemonic phrase to a compact SeedQR format
 * Each word is represented in binary (11 bits per word)
 */
export function encodeCompactSeedQR(mnemonic: string): string {
  const wordList = getWordList()
  const words = mnemonic.split(' ')
  const binaryString = words
    .map((word) => {
      const index = wordList.indexOf(word)
      if (index === -1) throw new Error(`Invalid mnemonic word: ${word}`)
      return index.toString(2).padStart(11, '0')
    })
    .join('')

  // Remove last 4 checksum bits for 12-word seeds
  return words.length === 12 ? binaryString.slice(0, -4) : binaryString
}

/**
 * Decodes a standard SeedQR format back to mnemonic phrase
 * Each word is represented by its index (from the BIP39 word list), zero-padded to four digits
 */
export function decodeStandardSeedQR(seedQR: string): string {
  const wordList = getWordList()
  const words: string[] = []

  // Split into 4-digit chunks
  for (let i = 0; i < seedQR.length; i += 4) {
    const chunk = seedQR.slice(i, i + 4)
    const index = parseInt(chunk, 10)
    if (index < 0 || index >= wordList.length) {
      throw new Error(`Invalid word index: ${index}`)
    }
    words.push(wordList[index])
  }

  return words.join(' ')
}

/**
 * Decodes a compact SeedQR format back to mnemonic phrase
 * Each word is represented in binary (11 bits per word)
 */
export function decodeCompactSeedQR(seedQR: string): string {
  const wordList = getWordList()
  const words: string[] = []

  // Calculate number of words based on length
  const wordCount = Math.floor(seedQR.length / 11)

  for (let i = 0; i < wordCount; i++) {
    const start = i * 11
    const end = start + 11
    const binaryChunk = seedQR.slice(start, end)
    const index = parseInt(binaryChunk, 2)
    if (index < 0 || index >= wordList.length) {
      throw new Error(`Invalid word index: ${index}`)
    }
    words.push(wordList[index])
  }

  return words.join(' ')
}

/**
 * Detects if a string is a seed QR code and returns the decoded mnemonic
 */
export function detectAndDecodeSeedQR(data: string): string | null {
  try {
    // Check if it's a standard seed QR (all digits, length divisible by 4)
    if (/^\d+$/.test(data) && data.length % 4 === 0) {
      return decodeStandardSeedQR(data)
    }

    // Check if it's a compact seed QR (all 0s and 1s, length divisible by 11)
    if (/^[01]+$/.test(data) && data.length % 11 === 0) {
      return decodeCompactSeedQR(data)
    }

    // Check if it's a plain mnemonic phrase (space-separated words)
    if (/^[a-z\s]+$/.test(data) && data.split(' ').length >= 12) {
      return data
    }

    return null
  } catch {
    return null
  }
}
