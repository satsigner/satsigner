export const ELECTRUM_CONNECTION_CHECK_INTERVAL = 50_000
export const ELECTRUM_CONNECTION_TIMEOUT = 900_000

// Cap the in-memory raw-transaction cache; cleared wholesale once full
// rather than evicted piecemeal since re-fetching is cheap and infrequent.
export const ELECTRUM_TX_CACHE_MAX_ENTRIES = 5000
