import { WORDLIST_LIST } from '@/types/bips/39'
import {
  generateMnemonicFromEntropy,
  getFingerprintFromMnemonic,
  validateMnemonic
} from '@/utils/bip39'
import {
  entropyBitsForWordCount,
  entropyFromCoinFlips,
  entropyFromDiceRolls,
  mixWithSystemEntropy,
  randomCoinFlip,
  randomDiceRoll,
  requiredDiceRolls
} from '@/utils/entropy'

const WORD_COUNTS = [12, 15, 18, 21, 24] as const

function diceRolls(bits: number, generator = randomDiceRoll): number[] {
  return Array.from({ length: requiredDiceRolls(bits) }, generator)
}

function coinFlips(bits: number, generator = randomCoinFlip): string[] {
  return Array.from({ length: bits }, generator)
}

describe('dice entropy produces valid mnemonics', () => {
  it('yields a valid mnemonic of the right length for every word count', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      const entropy = entropyFromDiceRolls(diceRolls(bits), bits)
      const mnemonic = generateMnemonicFromEntropy(entropy)

      expect(validateMnemonic(mnemonic)).toBe(true)
      expect(mnemonic.split(' ')).toHaveLength(wordCount)
    }
  })

  // Regression: this input previously softlocked the dice screen forever.
  it('yields a valid mnemonic from an all-lowest-face roll log', () => {
    const bits = entropyBitsForWordCount(24)
    const entropy = entropyFromDiceRolls(
      diceRolls(bits, () => 1),
      bits
    )
    const mnemonic = generateMnemonicFromEntropy(entropy)

    expect(validateMnemonic(mnemonic)).toBe(true)
    expect(mnemonic.split(' ')).toHaveLength(24)
  })

  it('yields a valid mnemonic for every constant-face roll log', () => {
    for (let face = 1; face <= 6; face += 1) {
      const entropy = entropyFromDiceRolls(
        diceRolls(128, () => face),
        128
      )
      expect(validateMnemonic(generateMnemonicFromEntropy(entropy))).toBe(true)
    }
  })

  it('derives a usable fingerprint', () => {
    const entropy = entropyFromDiceRolls(diceRolls(128), 128)
    const mnemonic = generateMnemonicFromEntropy(entropy)
    expect(getFingerprintFromMnemonic(mnemonic)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('produces distinct mnemonics across independent roll sessions', () => {
    const mnemonics = new Set<string>()
    for (let i = 0; i < 100; i += 1) {
      const entropy = entropyFromDiceRolls(diceRolls(128), 128)
      mnemonics.add(generateMnemonicFromEntropy(entropy))
    }
    expect(mnemonics.size).toBe(100)
  })

  it('is reproducible from the recorded roll log when unmixed', () => {
    const rolls = diceRolls(128)
    const first = generateMnemonicFromEntropy(entropyFromDiceRolls(rolls, 128))
    const second = generateMnemonicFromEntropy(entropyFromDiceRolls(rolls, 128))
    expect(first).toBe(second)
  })

  it('spreads first words across the wordlist', () => {
    const firstWords = new Set<string>()
    for (let i = 0; i < 300; i += 1) {
      const entropy = entropyFromDiceRolls(diceRolls(128), 128)
      firstWords.add(generateMnemonicFromEntropy(entropy).split(' ')[0])
    }
    expect(firstWords.size).toBeGreaterThan(100)
  })

  it('works with every supported wordlist', () => {
    for (const wordList of WORDLIST_LIST) {
      const entropy = entropyFromDiceRolls(diceRolls(128), 128)
      const mnemonic = generateMnemonicFromEntropy(entropy, wordList)
      expect(validateMnemonic(mnemonic, wordList)).toBe(true)
    }
  })
})

describe('coin entropy produces valid mnemonics', () => {
  it('yields a valid mnemonic of the right length for every word count', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      const entropy = entropyFromCoinFlips(coinFlips(bits), bits)
      const mnemonic = generateMnemonicFromEntropy(entropy)

      expect(validateMnemonic(mnemonic)).toBe(true)
      expect(mnemonic.split(' ')).toHaveLength(wordCount)
    }
  })

  it('yields a valid mnemonic from an all-zero flip log', () => {
    const entropy = entropyFromCoinFlips(
      Array.from({ length: 256 }, () => '0'),
      256
    )
    const mnemonic = generateMnemonicFromEntropy(entropy)
    expect(validateMnemonic(mnemonic)).toBe(true)
    expect(mnemonic.split(' ')).toHaveLength(24)
  })

  it('yields a valid mnemonic from a heavily biased flip log', () => {
    const flips = Array.from({ length: 256 }, () =>
      Math.random() < 0.9 ? '0' : '1'
    )
    const entropy = entropyFromCoinFlips(flips, 256)
    expect(validateMnemonic(generateMnemonicFromEntropy(entropy))).toBe(true)
  })

  it('produces distinct mnemonics across independent flip sessions', () => {
    const mnemonics = new Set<string>()
    for (let i = 0; i < 100; i += 1) {
      const entropy = entropyFromCoinFlips(coinFlips(128), 128)
      mnemonics.add(generateMnemonicFromEntropy(entropy))
    }
    expect(mnemonics.size).toBe(100)
  })

  it('spreads first words even when input is one-sided', () => {
    const firstWords = new Set<string>()
    for (let i = 0; i < 300; i += 1) {
      const flips = Array.from({ length: 128 }, () =>
        Math.random() < 0.85 ? '0' : '1'
      )
      const entropy = entropyFromCoinFlips(flips, 128)
      firstWords.add(generateMnemonicFromEntropy(entropy).split(' ')[0])
    }
    expect(firstWords.size).toBeGreaterThan(100)
  })
})

describe('mixed entropy produces valid mnemonics', () => {
  it('yields a valid mnemonic for every word count', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      const user = entropyFromDiceRolls(diceRolls(bits), bits)
      const mnemonic = generateMnemonicFromEntropy(
        mixWithSystemEntropy(user, bits)
      )

      expect(validateMnemonic(mnemonic)).toBe(true)
      expect(mnemonic.split(' ')).toHaveLength(wordCount)
    }
  })

  it('yields distinct mnemonics from an identical roll log', () => {
    const user = entropyFromDiceRolls(
      diceRolls(128, () => 1),
      128
    )
    const mnemonics = new Set<string>()
    for (let i = 0; i < 100; i += 1) {
      mnemonics.add(
        generateMnemonicFromEntropy(mixWithSystemEntropy(user, 128))
      )
    }
    expect(mnemonics.size).toBe(100)
  })

  it('differs from the unmixed mnemonic', () => {
    const bits = 128
    const user = entropyFromDiceRolls(
      diceRolls(bits, () => 3),
      bits
    )
    const unmixed = generateMnemonicFromEntropy(user)
    const mixed = generateMnemonicFromEntropy(mixWithSystemEntropy(user, bits))
    expect(mixed).not.toBe(unmixed)
  })
})

describe('generateMnemonicFromEntropy accepts all conditioned widths', () => {
  it('accepts every width the entropy helpers emit', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      const dice = entropyFromDiceRolls(diceRolls(bits), bits)
      const coin = entropyFromCoinFlips(coinFlips(bits), bits)

      expect(() => generateMnemonicFromEntropy(dice)).not.toThrow()
      expect(() => generateMnemonicFromEntropy(coin)).not.toThrow()
      expect(dice).toHaveLength(bits)
      expect(coin).toHaveLength(bits)
      expect(bits % 32).toBe(0)
    }
  })
})
