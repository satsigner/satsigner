const BYTE_VALUES = 256
const BITS_PER_BYTE = 8

export function shannonEntropy(
  counts: Map<number, number>,
  total: number
): number {
  return [...counts.values()].reduce((h, count) => {
    const p = count / total
    return h - p * Math.log2(p)
  }, 0)
}

export function byteHistogram(buffers: Uint8Array[]): Map<number, number> {
  const counts = new Map<number, number>(
    Array.from({ length: BYTE_VALUES }, (_, value) => [value, 0])
  )
  for (const buffer of buffers) {
    for (const byte of buffer) {
      counts.set(byte, (counts.get(byte) ?? 0) + 1)
    }
  }
  return counts
}

/** Chi-square statistic against a uniform 256-bin byte distribution. */
export function chiSquareBytes(buffers: Uint8Array[]): number {
  const counts = [...byteHistogram(buffers).values()]
  const total = counts.reduce((sum, count) => sum + count, 0)
  const expected = total / BYTE_VALUES
  return counts.reduce((chi, count) => {
    const delta = count - expected
    return chi + (delta * delta) / expected
  }, 0)
}

/**
 * Critical value for chi-square with 255 df at p≈0.001 (approx).
 * Values above this reject uniformity at that significance.
 */
export const CHI_SQUARE_255_P001 = 330.5

/**
 * Flattens buffers to one most-significant-bit-first stream. Index writes into
 * a preallocated array, since this runs over every sample the audit collects.
 */
function toBitStream(buffers: Uint8Array[]): Uint8Array {
  const totalBits = buffers.reduce(
    (sum, buffer) => sum + buffer.length * BITS_PER_BYTE,
    0
  )
  const bits = new Uint8Array(totalBits)
  let offset = 0
  for (const buffer of buffers) {
    for (const byte of buffer) {
      for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
        bits[offset + bit] = (byte >> (7 - bit)) & 1
      }
      offset += BITS_PER_BYTE
    }
  }
  return bits
}

/** Set-bit count for every byte value. */
const POPCOUNT = Uint8Array.from({ length: BYTE_VALUES }, (_, value) =>
  Array.from({ length: BITS_PER_BYTE }, (_, bit) => (value >> bit) & 1).reduce(
    (ones, bit) => ones + bit,
    0
  )
)

export function bitBalance(buffers: Uint8Array[]): number {
  const ones = buffers.reduce(
    (sum, buffer) =>
      buffer.reduce((inner, byte) => inner + POPCOUNT[byte], sum),
    0
  )
  const total = buffers.reduce(
    (sum, buffer) => sum + buffer.length * BITS_PER_BYTE,
    0
  )
  return ones / total
}

/** Lag-1 serial correlation of the bit stream in [-1, 1]. */
export function serialCorrelation(buffers: Uint8Array[]): number {
  const bits = toBitStream(buffers)
  if (bits.length < 2) {
    return 0
  }

  // Bits are 0 or 1, so x === x*x and y === y*y: sumX2/sumY2 collapse into
  // sumX/sumY. The sums stay an indexed loop because array-method equivalents
  // measured 3-4x slower over the sample counts the audit uses.
  const n = bits.length - 1
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  for (let i = 0; i < n; i += 1) {
    const x = bits[i]
    const y = bits[i + 1]
    sumX += x
    sumY += y
    sumXY += x * y
  }

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt(
    (n * sumX - sumX * sumX) * (n * sumY - sumY * sumY)
  )
  if (denominator === 0) {
    return 0
  }
  return numerator / denominator
}

/**
 * Biased sources repeat identical input logs, which re-counts the same digest
 * and violates the chi-square independence assumption. Distribution tests on
 * conditioned output should run on distinct samples.
 */
export function uniqueBuffers(buffers: Uint8Array[]): Uint8Array[] {
  const seen = new Set<string>()
  return buffers.filter((buffer) => {
    const key = Buffer.from(buffer).toString('hex')
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function collisionCount(buffers: Iterable<Uint8Array>): number {
  const seen = new Set<string>()
  return [...buffers].reduce((collisions, buffer) => {
    const key = Buffer.from(buffer).toString('hex')
    if (seen.has(key)) {
      return collisions + 1
    }
    seen.add(key)
    return collisions
  }, 0)
}

export function bitsToBytes(bits: string): Uint8Array {
  return Uint8Array.from({ length: bits.length / BITS_PER_BYTE }, (_, i) =>
    parseInt(
      bits.slice(i * BITS_PER_BYTE, i * BITS_PER_BYTE + BITS_PER_BYTE),
      2
    )
  )
}
