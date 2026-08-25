import QuickCrypto from 'react-native-quick-crypto'

import { type MnemonicWordCount } from '@/types/bips/39'

const DICE_FACES = 6
const COIN_SIDES = 2
const BITS_PER_BYTE = 8
const UINT32_RANGE = 0x100000000
const SHA512_BITS = 512
const MAX_PATTERN_PERIOD = 12

export type EntropyOptions = {
  /**
   * When true, skip the minimum-length check so partial input can be hashed for
   * live previews. Final seed generation must leave this unset/false.
   */
  allowPartial?: boolean
}

/**
 * Offline reproduction (mix off):
 *   SHA-512("dice:" + rolls.join(","))[0 .. bits/8]
 *   SHA-512("coin:" + flips.join(""))[0 .. bits/8]
 * Digests are SHA-512; only the leading bits/8 bytes are kept as the BIP39
 * entropy bitstring.
 *
 * Raw user input is never used as entropy directly. It is conditioned through
 * SHA-512 so that a biased or degenerate input sequence still yields a uniform
 * *byte distribution*. Hashing does not add entropy — unmixed seeds are only
 * as strong as the user's input.
 */
function hashToBits(domain: string, input: string, bits: number): string {
  if (!Number.isInteger(bits) || bits <= 0 || bits > SHA512_BITS) {
    throw new Error(`bits must be an integer in (0, ${SHA512_BITS}]`)
  }
  if (bits % BITS_PER_BYTE !== 0) {
    throw new Error('bits must be divisible by 8')
  }

  const digest = QuickCrypto.createHash('sha512')
    .update(`${domain}:${input}`)
    .digest()

  return Array.from(digest.subarray(0, bits / BITS_PER_BYTE))
    .map((byte) => byte.toString(2).padStart(BITS_PER_BYTE, '0'))
    .join('')
}

// BIP39: every 3 mnemonic words encode 32 bits of entropy (plus checksum bits).
const BIP39_ENTROPY_BITS_PER_3_WORDS = 32

export function entropyBitsForWordCount(wordCount: MnemonicWordCount): number {
  return BIP39_ENTROPY_BITS_PER_3_WORDS * (wordCount / 3)
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
export function entropyFromDiceRolls(
  rolls: number[],
  bits: number,
  options: EntropyOptions = {}
): string {
  if (
    rolls.some(
      (face) => !Number.isInteger(face) || face < 1 || face > DICE_FACES
    )
  ) {
    throw new Error('Invalid dice roll: faces must be integers in [1, 6]')
  }
  if (!options.allowPartial && rolls.length < requiredDiceRolls(bits)) {
    throw new Error(
      `Need at least ${requiredDiceRolls(bits)} dice rolls for ${bits} bits`
    )
  }
  return hashToBits('dice', rolls.join(','), bits)
}

export function entropyFromCoinFlips(
  flips: string[],
  bits: number,
  options: EntropyOptions = {}
): string {
  if (flips.some((flip) => flip !== '0' && flip !== '1')) {
    throw new Error("Invalid coin flip: values must be '0' or '1'")
  }
  if (!options.allowPartial && flips.length < requiredCoinFlips(bits)) {
    throw new Error(
      `Need at least ${requiredCoinFlips(bits)} coin flips for ${bits} bits`
    )
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
  if (userEntropy.length !== bits || !/^[01]+$/.test(userEntropy)) {
    throw new Error(
      'userEntropy must be a binary string of the requested width'
    )
  }
  const byteCount = bits / BITS_PER_BYTE
  const systemBytes = new Uint8Array(byteCount)
  // Same CSPRNG surface as randomIndex / randomNum (react-native-get-random-values).
  crypto.getRandomValues(systemBytes)
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

/**
 * True when the sequence is an exact repetition of a short cycle (e.g. 1,2,3,4,5,6
 * repeating). First-order bias checks miss this; true entropy is near zero.
 *
 * Detects exact repetition only: a single deviation from the cycle defeats it.
 * Best-effort nudge for obviously non-random input, not a randomness test.
 */
export function isSequencePatterned(symbols: string[]): boolean {
  if (symbols.length < 8) {
    return false
  }

  const maxPeriod = Math.min(Math.floor(symbols.length / 3), MAX_PATTERN_PERIOD)

  for (let period = 1; period <= maxPeriod; period += 1) {
    let matches = true
    for (let i = period; i < symbols.length; i += 1) {
      if (symbols[i] !== symbols[i % period]) {
        matches = false
        break
      }
    }
    if (matches) {
      return true
    }
  }

  return false
}

/** True when first-order bias or a short repeating cycle makes input weak. */
export function isSequenceWeak(
  symbols: string[],
  alphabetSize: number,
  threshold = 0.85
): boolean {
  return (
    isSequenceBiased(symbols, alphabetSize, threshold) ||
    isSequencePatterned(symbols)
  )
}
