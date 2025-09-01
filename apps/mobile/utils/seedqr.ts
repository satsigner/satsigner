/**
 * Converts a mnemonic phrase to a standard SeedQR format
 * Each word is represented by its index (from the BIP39 word list), zero-padded to four digits
 */
export function encodeStandardSeedQR(
  mnemonic: string,
  wordList: string[]
): string {
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
export function encodeCompactSeedQR(
  mnemonic: string,
  wordList: string[]
): string {
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
