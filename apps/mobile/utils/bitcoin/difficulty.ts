// Compact `nBits` difficulty-target encoding: a 1-byte exponent followed by a
// 3-byte mantissa, expanded as mantissa * 256^(exponent - 3).
const NBITS_EXPONENT_SHIFT = 24
const NBITS_MANTISSA_MASK = 0x007fffff
const NBITS_EXPONENT_BYTE_OFFSET = 3
const BITS_PER_BYTE = 8

export function getDifficultyFromBits(bits: number): number {
  const exponent = bits >>> NBITS_EXPONENT_SHIFT
  const mantissa = bits & NBITS_MANTISSA_MASK
  let target = BigInt(mantissa)
  const shift = BITS_PER_BYTE * (exponent - NBITS_EXPONENT_BYTE_OFFSET)
  if (shift >= 0) {
    target *= 1n << BigInt(shift)
  } else {
    target /= 1n << BigInt(-shift)
  }
  const maxTarget =
    0x00000000ffff0000000000000000000000000000000000000000000000000000n
  return Number(maxTarget) / Number(target)
}
