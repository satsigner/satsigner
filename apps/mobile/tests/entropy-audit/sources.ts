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
    default: {
      const _exhaustive: never = name
      throw new Error(`Unknown source: ${_exhaustive}`)
    }
  }
}
