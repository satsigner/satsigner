// Sentinel thrown by the Core-wallet sync path when a sync is cancelled
// mid-flight (e.g. superseded by a priority sync). Callers compare against
// this instead of a bare string literal so the contract stays in one place.
const SYNC_CANCELLED_ERROR = 'sync-cancelled'

// Empty wallets with a BDK checkpoint below this height are treated as never
// scanned (genesis-adjacent). History on the account still forces incremental.
const MIN_USABLE_CHECKPOINT_HEIGHT = 10_000

// Wallet blocks compared with the server before a sync to tell a reorg from
// another chain. A reorg deeper than this many of them reads as another chain
// and costs a full rescan.
const WALLET_CHAIN_CHECK_LIMIT = 10

// A chain check that takes longer is skipped and the sync goes ahead.
const WALLET_CHAIN_CHECK_TIMEOUT_MS = 30_000
const WALLET_CHAIN_CHECK_TOR_TIMEOUT_MS = 90_000

// Background account syncs that run at once. Each BDK wallet has its own
// lock, so different wallets can scan in parallel; more than a few mostly
// adds load on the server (and on a Tor circuit).
const SYNC_CONCURRENCY = 2

// A sync is aborted after this long without progress. Tor circuits are slow
// to build and Bitcoin Core rescans report progress only every few blocks.
const SYNC_STALL_TIMEOUT_MS = 2 * 60_000
const SYNC_STALL_TIMEOUT_TOR_MS = 5 * 60_000
const SYNC_STALL_TIMEOUT_RPC_MS = 15 * 60_000

// While a Core sync waits for another one on the same node, it reports
// progress this often so the wait doesn't count as a stall.
const CORE_NODE_WAIT_HEARTBEAT_MS = 30_000

// Fiat prices for new transactions are looked up after the scan; past this
// the sync is saved without the missing prices.
const SYNC_PRICE_LOOKUP_TIMEOUT_MS = 30_000

// Batch syncs show one toast per failing account up to this many accounts
// with the same cause; beyond it they share one toast.
const SYNC_FAILURE_TOAST_LIMIT = 2

// The native sync has no cancel or timeout, so a run waits this long at most
// for a superseded run of the same account before giving up.
const SUPERSEDED_SYNC_WAIT_TIMEOUT_MS = 15_000

export {
  CORE_NODE_WAIT_HEARTBEAT_MS,
  MIN_USABLE_CHECKPOINT_HEIGHT,
  SUPERSEDED_SYNC_WAIT_TIMEOUT_MS,
  SYNC_CANCELLED_ERROR,
  SYNC_CONCURRENCY,
  SYNC_FAILURE_TOAST_LIMIT,
  SYNC_PRICE_LOOKUP_TIMEOUT_MS,
  SYNC_STALL_TIMEOUT_MS,
  SYNC_STALL_TIMEOUT_RPC_MS,
  SYNC_STALL_TIMEOUT_TOR_MS,
  WALLET_CHAIN_CHECK_LIMIT,
  WALLET_CHAIN_CHECK_TIMEOUT_MS,
  WALLET_CHAIN_CHECK_TOR_TIMEOUT_MS
}
