// Units and thresholds used by the formatters in `@/utils/format`.

export const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const
export const BYTES_PER_KIB = 1024

// Short-scale threshold: above it, `formatLargeNumber` spells the word out
// instead of relying on Intl compact notation.
export const QUADRILLION = 1e15

// Long-scale (European) thresholds for the same fallback.
export const BILLIARD = 1e15
export const TRILLION_LONG = 1e18
export const TRILLIARD = 1e21

export const COMPACT_LONG_OPTS: Intl.NumberFormatOptions = {
  compactDisplay: 'long',
  notation: 'compact'
}
