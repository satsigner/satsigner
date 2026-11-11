export const ELECTRUM_CONNECTION_CHECK_INTERVAL = 50_000
export const ELECTRUM_CONNECTION_TIMEOUT = 900_000

// Bounds the native TCP connect: a dead server would otherwise hold one of
// react-native-tcp-socket's two worker threads for the kernel SYN timeout.
export const ELECTRUM_CONNECT_TIMEOUT_MS = 10_000
// Reaching an onion service builds a Tor circuit first.
export const ELECTRUM_CONNECT_TOR_TIMEOUT_MS = 60_000

// Cap the in-memory raw-transaction cache; cleared wholesale once full
// rather than evicted piecemeal since re-fetching is cheap and infrequent.
export const ELECTRUM_TX_CACHE_MAX_ENTRIES = 5000
