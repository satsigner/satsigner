/**
 * Rough offline-cracking cost estimate for BIP39 passphrases.
 *
 * BIP39 seed derivation is only PBKDF2-HMAC-SHA512 with 2048 rounds (~11 bits
 * of effective cost), so the passphrase is essentially the whole defense
 * against an attacker holding the mnemonic. This estimator deliberately errs
 * on the pessimistic side: character-pool math overestimates human-chosen
 * passwords, so common patterns are capped hard.
 */

export type PassphraseStrengthLevel = 'empty' | 'weak' | 'fair' | 'strong'

export type PassphraseStrength = {
  /** Estimated guessing cost in bits (log2 of expected attempts). */
  bits: number
  level: PassphraseStrengthLevel
}

const WEAK_THRESHOLD_BITS = 50
const STRONG_THRESHOLD_BITS = 80

// A single English word is drawn from at most a few hundred thousand
// candidates (~17..18 bits); a word from the BIP39 list is exactly 11 bits.
const SINGLE_WORD_MAX_BITS = 18

const TRIVIAL_PASSWORDS = new Set([
  '1234',
  '12345',
  '123456',
  '1234567',
  '12345678',
  '111111',
  '121212',
  'abc123',
  'bitcoin',
  'hodl',
  'letmein',
  'password',
  'password1',
  'qwerty',
  'satoshi',
  'secret'
])

const TRIVIAL_BITS = 10

function characterPoolSize(passphrase: string): number {
  let pool = 0
  if (/[a-z]/.test(passphrase)) {
    pool += 26
  }
  if (/[A-Z]/.test(passphrase)) {
    pool += 26
  }
  if (/[0-9]/.test(passphrase)) {
    pool += 10
  }
  if (/[^a-zA-Z0-9\s]/.test(passphrase)) {
    pool += 32
  }
  if (/\s/.test(passphrase)) {
    pool += 1
  }
  return pool
}

export function estimatePassphraseStrength(
  passphrase: string
): PassphraseStrength {
  if (passphrase.length === 0) {
    return { bits: 0, level: 'empty' }
  }

  if (TRIVIAL_PASSWORDS.has(passphrase.toLowerCase())) {
    return { bits: TRIVIAL_BITS, level: 'weak' }
  }

  const pool = characterPoolSize(passphrase)
  let bits = passphrase.length * Math.log2(pool)

  // Single dictionary word: pool math wildly overestimates these.
  if (/^[a-zA-Z]+$/.test(passphrase) && !passphrase.includes(' ')) {
    bits = Math.min(bits, SINGLE_WORD_MAX_BITS)
  }

  // One repeated character (aaaaaa…): guessing cost is the pool, not length.
  if (/^(.)\1*$/.test(passphrase)) {
    bits = Math.min(bits, Math.log2(pool))
  }

  bits = Math.floor(bits)

  const level: PassphraseStrengthLevel =
    bits < WEAK_THRESHOLD_BITS
      ? 'weak'
      : bits < STRONG_THRESHOLD_BITS
        ? 'fair'
        : 'strong'

  return { bits, level }
}
