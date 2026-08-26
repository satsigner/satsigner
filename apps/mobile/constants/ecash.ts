// Number of proofs restored per counter-batch during a mint restore scan.
export const ECASH_RESTORE_BATCH_SIZE = 25
// Per-batch mint request timeout during a restore scan.
export const ECASH_RESTORE_TIMEOUT_MS = 15000
// Consecutive empty batches before the restore scan gives up (gap limit).
export const ECASH_MAX_EMPTY_BATCHES = 2
export const MSATS_PER_SAT = 1000
export const ECASH_BACKUP_VERSION = '1.1'
export const NUT15_MPP = 15 as const
export const BOLT11_METHOD = 'bolt11'
export const SAT_UNIT = 'sat'
