const SHORT_SCALE = [
  { value: 1e15, word: 'quadrillion' },
  { value: 1e12, word: 'trillion' },
  { value: 1e9, word: 'billion' },
  { value: 1e6, word: 'million' },
  { value: 1e3, word: 'thousand' }
]

const LONG_SCALE = [
  { value: 1e21, word: 'trilliard' },
  { value: 1e18, word: 'trillion' },
  { value: 1e15, word: 'billiard' },
  { value: 1e12, word: 'billion' },
  { value: 1e9, word: 'milliard' },
  { value: 1e6, word: 'million' },
  { value: 1e3, word: 'thousand' }
]

export function formatLargeNumber(num: number, european = false): string {
  if (!isFinite(num) || num === 0) return ''

  const isNegative = num < 0
  const abs = Math.abs(num)
  const thresholds = european ? LONG_SCALE : SHORT_SCALE

  for (const { value, word } of thresholds) {
    if (abs >= value) {
      const rounded = Math.round(abs / value)
      const approx = rounded * value !== abs ? '~' : ''
      return `${isNegative ? '-' : ''}${approx}${rounded} ${word}${rounded > 1 ? 's' : ''}`
    }
  }

  return ''
}
