// Default well-known Bitcoin Core RPC ports per network.
export const RPC_DEFAULT_PORT_MAINNET = 8332
export const RPC_DEFAULT_PORT_SIGNET = 38332
export const RPC_DEFAULT_PORT_TESTNET = 18332

// Default timeout for a single RPC call. A hung/unreachable node must not
// stall sync or the UI indefinitely — see RPC_RESCAN_TIMEOUT_MS for the one
// call that legitimately needs a much longer budget.
export const RPC_DEFAULT_TIMEOUT_MS = 30_000

// A synchronous rescanblockchain call blocks until the scan finishes, which
// can take hours. Give it a budget of its own so the AbortController doesn't
// cut it off before the caller's shorter race has a chance to poll instead.
export const RPC_RESCAN_TIMEOUT_MS = 6 * 60 * 60 * 1000

// listtransactions defaults to 10; pass a large count to mean "return all".
export const RPC_LIST_TRANSACTIONS_COUNT = 99_999
