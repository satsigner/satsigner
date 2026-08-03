export function shannonEntropy(
  counts: Map<number, number>,
  total: number
): number {
  let h = 0
  for (const count of counts.values()) {
    const p = count / total
    h -= p * Math.log2(p)
  }
  return h
}

export function byteHistogram(buffers: Uint8Array[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (let i = 0; i < 256; i += 1) {
    counts.set(i, 0)
  }
  for (const buffer of buffers) {
    for (const byte of buffer) {
      counts.set(byte, (counts.get(byte) ?? 0) + 1)
    }
  }
  return counts
}

/** Chi-square statistic against a uniform 256-bin byte distribution. */
export function chiSquareBytes(buffers: Uint8Array[]): number {
  const counts = byteHistogram(buffers)
  let total = 0
  for (const count of counts.values()) {
    total += count
  }
  const expected = total / 256
  let chi = 0
  for (const count of counts.values()) {
    const delta = count - expected
    chi += (delta * delta) / expected
  }
  return chi
}

/**
 * Critical value for chi-square with 255 df at p≈0.001 (approx).
 * Values above this reject uniformity at that significance.
 */
export const CHI_SQUARE_255_P001 = 330.5

export function bitBalance(buffers: Uint8Array[]): number {
  let ones = 0
  let total = 0
  for (const buffer of buffers) {
    for (const byte of buffer) {
      for (let bit = 0; bit < 8; bit += 1) {
        ones += (byte >> bit) & 1
        total += 1
      }
    }
  }
  return ones / total
}

/** Lag-1 serial correlation of the bit stream in [-1, 1]. */
export function serialCorrelation(buffers: Uint8Array[]): number {
  const bits: number[] = []
  for (const buffer of buffers) {
    for (const byte of buffer) {
      for (let bit = 7; bit >= 0; bit -= 1) {
        bits.push((byte >> bit) & 1)
      }
    }
  }
  if (bits.length < 2) {
    return 0
  }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0
  const n = bits.length - 1
  for (let i = 0; i < n; i += 1) {
    const x = bits[i]
    const y = bits[i + 1]
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
    sumY2 += y * y
  }

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  )
  if (denominator === 0) {
    return 0
  }
  return numerator / denominator
}

export function collisionCount(buffers: Uint8Array[]): number {
  const seen = new Set<string>()
  let collisions = 0
  for (const buffer of buffers) {
    const key = Buffer.from(buffer).toString('hex')
    if (seen.has(key)) {
      collisions += 1
    } else {
      seen.add(key)
    }
  }
  return collisions
}

export function bitsToBytes(bits: string): Uint8Array {
  const bytes = new Uint8Array(bits.length / 8)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  }
  return bytes
}
