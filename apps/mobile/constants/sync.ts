// Sentinel thrown by the Core-wallet sync path when a sync is cancelled
// mid-flight (e.g. superseded by a priority sync). Callers compare against
// this instead of a bare string literal so the contract stays in one place.
const SYNC_CANCELLED_ERROR = 'sync-cancelled'

// Empty wallets with a BDK checkpoint below this height are treated as never
// scanned (genesis-adjacent). History on the account still forces incremental.
const MIN_USABLE_CHECKPOINT_HEIGHT = 10_000

export { MIN_USABLE_CHECKPOINT_HEIGHT, SYNC_CANCELLED_ERROR }
