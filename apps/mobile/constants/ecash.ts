// Number of proofs restored per counter-batch during a mint restore scan.
export const ECASH_RESTORE_BATCH_SIZE = 25
// Per-batch mint request timeout during a restore scan.
export const ECASH_RESTORE_TIMEOUT_MS = 15_000
// Consecutive empty batches before the restore scan gives up (gap limit).
export const ECASH_MAX_EMPTY_BATCHES = 2
export const ECASH_BACKUP_VERSION = '1.1'
export const NUT15_MPP = 15 as const
export const BOLT11_METHOD = 'bolt11'
export const SAT_UNIT = 'sat'
export const MAX_MPP_FEE_SLICE_ATTEMPTS = 3
// A fresh invoice is checked often, since its payer is likely paying right now.
export const ECASH_QUOTE_POLL_INTERVAL_MS = 1500
export const ECASH_PENDING_MINT_FAST_POLL_WINDOW_MS = 180_000
export const ECASH_PENDING_MINT_SLOW_POLL_INTERVAL_MS = 15_000
// An unpaid quote past its invoice expiry plus this grace never gets paid.
export const ECASH_MINT_QUOTE_EXPIRY_GRACE_MS = 600_000
// Deadline for an unpaid quote whose mint gave no expiry.
export const ECASH_PENDING_MINT_MAX_AGE_MS = 86_400_000
// Each mint attempt reserves deterministic counters; repeated failures would
// open a gap wider than the seed restore scans.
export const ECASH_MAX_FAILED_MINT_ATTEMPTS = 3
export const ECASH_PAYMENT_ERROR_I18N_KEYS = {
  insufficientForFees: 'ecash.error.insufficientForFees',
  insufficientProofs: 'ecash.error.insufficientProofs',
  meltPending: 'ecash.error.meltPending',
  meltUnpaid: 'ecash.error.meltUnpaid',
  mintsLackMpp: 'ecash.error.mintsLackMpp'
} as const
