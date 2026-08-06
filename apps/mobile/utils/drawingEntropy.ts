import QuickCrypto from 'react-native-quick-crypto'

export type DrawingPoint = {
  t: number
  x: number
  y: number
}

export const DRAWING_BITS_PER_SAMPLE = 1
export const DRAWING_SAMPLE_MIN_DISTANCE_PX = 10

export function distanceBetweenPoints(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function shouldAcceptDrawingSample(
  last: { x: number; y: number } | null,
  next: { x: number; y: number },
  minDistance = DRAWING_SAMPLE_MIN_DISTANCE_PX
): boolean {
  if (!last) {
    return true
  }
  return distanceBetweenPoints(last, next) >= minDistance
}

export function estimatedDrawingBits(sampleCount: number): number {
  return sampleCount * DRAWING_BITS_PER_SAMPLE
}

export function serializeDrawingPoints(points: DrawingPoint[]): string {
  return points
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)},${point.t}`)
    .join(';')
}

export function hexToBinary(hex: string): string {
  let binary = ''
  for (const char of hex) {
    binary += Number.parseInt(char, 16).toString(2).padStart(4, '0')
  }
  return binary
}

export function drawingPointsToBinary(
  points: DrawingPoint[],
  bitLength: number
): string {
  if (bitLength < 128 || bitLength > 256 || bitLength % 32 !== 0) {
    throw new Error('Invalid Entropy: it must be range of [128, 256]')
  }

  const hash = QuickCrypto.createHash('sha256')
  hash.update(serializeDrawingPoints(points))
  const hex = hash.digest().toString('hex')
  return hexToBinary(hex).slice(0, bitLength)
}

export function getDrawingEntropyProgress(
  sampleCount: number,
  bitLength: number
): { complete: boolean; estimatedBits: number } {
  const estimatedBits = Math.min(estimatedDrawingBits(sampleCount), bitLength)
  return {
    complete: estimatedDrawingBits(sampleCount) >= bitLength,
    estimatedBits
  }
}
