export function getDifficultyFromBits(bits: number): number {
  const exponent = bits >>> 24
  const mantissa = bits & 0x007fffff
  let target = BigInt(mantissa)
  const shift = 8 * (exponent - 3)
  if (shift >= 0) {
    target *= 1n << BigInt(shift)
  } else {
    target /= 1n << BigInt(-shift)
  }
  const maxTarget =
    0x00000000ffff0000000000000000000000000000000000000000000000000000n
  return Number(maxTarget) / Number(target)
}
