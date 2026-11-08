// Sentinel thrown by the Core-wallet sync path when a sync is cancelled
// mid-flight (e.g. superseded by a priority sync). Callers compare against
// this instead of a bare string literal so the contract stays in one place.
const SYNC_CANCELLED_ERROR = 'sync-cancelled'

// Empty wallets with a BDK checkpoint below this height are treated as never
// scanned (genesis-adjacent). History on the account still forces incremental.
const MIN_USABLE_CHECKPOINT_HEIGHT = 10_000

const SYNC_IDLE_POLL_ATTEMPTS = 60
const SYNC_IDLE_POLL_INTERVAL_MS = 100

// Batch syncs show one toast per failing account up to this many accounts
// with the same cause; beyond it they share one toast.
const SYNC_FAILURE_TOAST_LIMIT = 2

export {
  MIN_USABLE_CHECKPOINT_HEIGHT,
  SYNC_CANCELLED_ERROR,
  SYNC_FAILURE_TOAST_LIMIT,
  SYNC_IDLE_POLL_ATTEMPTS,
  SYNC_IDLE_POLL_INTERVAL_MS
}
