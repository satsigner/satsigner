import QuickCrypto from 'react-native-quick-crypto'

import { MnemonicWordCount } from '@/types/bips/39'

const DICE_FACES = 6
const COIN_SIDES = 2
const BITS_PER_BYTE = 8
const UINT32_RANGE = 0x100000000

/**
 * Raw user input is never used as entropy directly. It is conditioned through
 * SHA-512 so that a biased or degenerate input sequence (an unfair coin, a user
 * tapping one button repeatedly) still yields a uniform output, and so that
 * every input position affects the result.
 */
function hashToBits(domain: string, input: string, bits: number): string {
  const digest = QuickCrypto.createHash('sha512')
    .update(`${domain}:${input}`)
    .digest()

  return Array.from(digest.subarray(0, bits / BITS_PER_BYTE))
    .map((byte) => byte.toString(2).padStart(BITS_PER_BYTE, '0'))
    .join('')
}

export function entropyBitsForWordCount(wordCount: MnemonicWordCount): number {
  return 32 * (wordCount / 3)
}

/** Number of dice rolls needed to cover `bits` of entropy at log2(6) per roll. */
export function requiredDiceRolls(bits: number): number {
  return Math.ceil(bits / Math.log2(DICE_FACES))
}

export function requiredCoinFlips(bits: number): number {
  return bits
}

/**
 * Rolls are printed die faces (1..6), so the sequence the user records on paper
 * matches the sequence hashed here.
 */
export function entropyFromDiceRolls(rolls: number[], bits: number): string {
  if (rolls.some((face) => !Number.isInteger(face) || face < 1 || face > 6)) {
    throw new Error('Invalid dice roll: faces must be integers in [1, 6]')
  }
  return hashToBits('dice', rolls.join(','), bits)
}

export function entropyFromCoinFlips(flips: string[], bits: number): string {
  if (flips.some((flip) => flip !== '0' && flip !== '1')) {
    throw new Error("Invalid coin flip: values must be '0' or '1'")
  }
  return hashToBits('coin', flips.join(''), bits)
}

/**
 * Folds device CSPRNG output into user-supplied entropy. The result is no
 * weaker than the stronger of the two sources, so a degenerate manual sequence
 * cannot produce a weak seed.
 *
 * Trade-off: the seed is no longer reproducible from the dice/coin log alone.
 * Callers that need an auditable paper trail must opt out.
 */
export function mixWithSystemEntropy(
  userEntropy: string,
  bits: number
): string {
  const systemBytes = QuickCrypto.randomBytes(bits / BITS_PER_BYTE)
  const system = Buffer.from(systemBytes).toString('hex')
  return hashToBits('mix', `${userEntropy}|${system}`, bits)
}

/**
 * Uniform integer in [0, bound) via rejection sampling. Rejecting the final
 * partial block avoids the modulo bias that `random() * bound` introduces.
 */
export function randomIndex(bound: number): number {
  if (!Number.isInteger(bound) || bound <= 0) {
    throw new Error('bound must be a positive integer')
  }

  const limit = Math.floor(UINT32_RANGE / bound) * bound
  const buffer = new Uint32Array(1)
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)

  return buffer[0] % bound
}

export function randomDiceRoll(): number {
  return randomIndex(DICE_FACES) + 1
}

export function randomCoinFlip(): '0' | '1' {
  return randomIndex(COIN_SIDES) === 0 ? '0' : '1'
}

/**
 * Shannon entropy per symbol of the observed distribution, in bits. Used to
 * warn when a manual sequence looks strongly biased. This measures only
 * first-order bias, not sequential patterns, so it is an upper bound on the
 * true entropy rate.
 */
export function observedEntropyRate(symbols: string[]): number {
  if (symbols.length === 0) {
    return 0
  }

  const counts = new Map<string, number>()
  for (const symbol of symbols) {
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1)
  }

  let rate = 0
  for (const count of counts.values()) {
    const p = count / symbols.length
    rate -= p * Math.log2(p)
  }

  return rate
}

/** True when input bias is severe enough to be worth surfacing to the user. */
export function isSequenceBiased(
  symbols: string[],
  alphabetSize: number,
  threshold = 0.85
): boolean {
  if (symbols.length < alphabetSize * 2) {
    return false
  }
  const ideal = Math.log2(alphabetSize)
  return observedEntropyRate(symbols) / ideal < threshold
}
