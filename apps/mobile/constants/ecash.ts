// Number of proofs restored per counter-batch during a mint restore scan.
export const ECASH_RESTORE_BATCH_SIZE = 25
// Per-batch mint request timeout during a restore scan.
export const ECASH_RESTORE_TIMEOUT_MS = 15000
// Consecutive empty batches before the restore scan gives up (gap limit).
export const ECASH_MAX_EMPTY_BATCHES = 2
export const ECASH_BACKUP_VERSION = '1.1'
export const NUT15_MPP = 15 as const
export const BOLT11_METHOD = 'bolt11'
export const SAT_UNIT = 'sat'
export const MAX_MPP_FEE_SLICE_ATTEMPTS = 3
export const ECASH_QUOTE_POLL_INTERVAL_MS = 1500
export const ECASH_QUOTE_MAX_POLL_ATTEMPTS = 120
export const ECASH_PAYMENT_ERROR_I18N_KEYS = {
  insufficientForFees: 'ecash.error.insufficientForFees',
  insufficientProofs: 'ecash.error.insufficientProofs',
  mintsLackMpp: 'ecash.error.mintsLackMpp'
} as const
