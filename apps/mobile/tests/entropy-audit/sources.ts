import {
  entropyFromCoinFlips,
  entropyFromDiceRolls,
  mixWithSystemEntropy,
  requiredCoinFlips,
  requiredDiceRolls
} from '../../utils/entropy'
import { bitsToBytes } from './stats'

export type EntropySourceName =
  | 'csprng'
  | 'dice'
  | 'diceBiased'
  | 'coin'
  | 'coinBiased'
  | 'mix'
  | 'brokenRestricted'
  | 'brokenLowEntropy'

const LOW_ENTROPY_SEED_BITS = 30
const LCG_MULTIPLIER = 1664525
const LCG_INCREMENT = 1013904223

export function sampleCsprng(byteCount: number): Uint8Array {
  const bytes = new Uint8Array(byteCount)
  crypto.getRandomValues(bytes)
  return bytes
}

/** Deliberately broken: leading byte restricted to 5 values (old dice bug class). */
export function sampleBrokenRestricted(byteCount: number): Uint8Array {
  const bytes = new Uint8Array(byteCount)
  crypto.getRandomValues(bytes)
  bytes[0] %= 5
  return bytes
}

/**
 * Deliberately broken: entire roll sequence derived from a ~30-bit seed via an
 * LCG (Trust Wallet 2023 class bug). Distribution tests cannot see this through
 * the hash; only the collision test catches it.
 */
export function sampleBrokenLowEntropy(bits: number): Uint8Array {
  const seedBytes = new Uint32Array(1)
  crypto.getRandomValues(seedBytes)
  let state = seedBytes[0] >>> (32 - LOW_ENTROPY_SEED_BITS)
  const rolls = Array.from({ length: requiredDiceRolls(bits) }, () => {
    // No `>>> 0` wrap needed: Math.imul and `>>>` both reduce mod 2^32.
    state = Math.imul(state, LCG_MULTIPLIER) + LCG_INCREMENT
    return 1 + ((state >>> 8) % 6)
  })
  return bitsToBytes(entropyFromDiceRolls(rolls, bits))
}

export function sampleDice(bits: number, face: () => number): Uint8Array {
  const rolls = Array.from({ length: requiredDiceRolls(bits) }, face)
  return bitsToBytes(entropyFromDiceRolls(rolls, bits))
}

export function sampleCoin(bits: number, flip: () => '0' | '1'): Uint8Array {
  const flips = Array.from({ length: requiredCoinFlips(bits) }, flip)
  return bitsToBytes(entropyFromCoinFlips(flips, bits))
}

export function sampleMixedDice(bits: number): Uint8Array {
  const user = entropyFromDiceRolls(
    Array.from({ length: requiredDiceRolls(bits) }, () => 1),
    bits
  )
  return bitsToBytes(mixWithSystemEntropy(user, bits))
}

export function sampleSource(
  name: EntropySourceName,
  byteCount: number
): Uint8Array {
  const bits = byteCount * 8
  switch (name) {
    case 'csprng':
      return sampleCsprng(byteCount)
    case 'dice':
      return sampleDice(bits, () => 1 + Math.floor(Math.random() * 6))
    case 'diceBiased':
      return sampleDice(bits, () => (Math.random() < 0.9 ? 1 : 2))
    case 'coin':
      return sampleCoin(bits, () => (Math.random() < 0.5 ? '0' : '1'))
    case 'coinBiased':
      return sampleCoin(bits, () => (Math.random() < 0.9 ? '0' : '1'))
    case 'mix':
      return sampleMixedDice(bits)
    case 'brokenRestricted':
      return sampleBrokenRestricted(byteCount)
    case 'brokenLowEntropy':
      return sampleBrokenLowEntropy(bits)
    default: {
      const _exhaustive: never = name
      throw new Error(`Unknown source: ${_exhaustive}`)
    }
  }
}
