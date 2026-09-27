// Units and thresholds used by the formatters in `@/utils/format`.

export const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const
// Decimal places per unit in FILE_SIZE_UNITS; trailing zeros are stripped.
export const BYTE_UNIT_DECIMALS = [0, 1, 2, 2]
// Bases for byte formatting: SI (1000) and binary (1024).
export const BYTES_PER_KB = 1000
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

// Head/tail character counts for truncating txids/addresses in the UI, tiered
// by how much horizontal space the surface has. Passing a single width to
// truncate/formatTxId makes head === tail.
export const ADDRESS_TRUNCATE_CHARS_DEFAULT = 8 // formatAddress() default
export const PUBKEY_SHORT_HEAD_CHARS = 5 // formatShortPubkey() default
export const PUBKEY_SHORT_TAIL_CHARS = 6

export const TXID_TRUNCATE_CHARS_TINY = 3 // history chart labels
export const TXID_TRUNCATE_CHARS_COMPACT = 4 // dense cards & flow-diagram nodes
export const TXID_TRUNCATE_CHARS = 6 // flow-diagram block node
export const TXID_TRUNCATE_CHARS_WIDE = 8 // explorer & ark detail rows

export const ADDRESS_TRUNCATE_CHARS_COMPACT = 4 // flow-diagram output nodes
export const ADDRESS_TRUNCATE_CHARS = 6 // cards & detail rows

// Vtxo ids get their own width so it can diverge from txids later.
export const VTXO_ID_TRUNCATE_CHARS = 8

// Explorer address row shows an asymmetric head/tail.
export const EXPLORER_ADDRESS_HEAD_CHARS = 10
export const EXPLORER_ADDRESS_TAIL_CHARS = 8
