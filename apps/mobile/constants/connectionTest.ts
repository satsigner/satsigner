export const CONNECTION_TEST_TIMEOUT_MS = 10_000
export const CONNECTION_TEST_COOLDOWN_MS = 2000

// How long a reachability check before a BDK Electrum connect is reused, so a
// round of account syncs against one dead server waits for it only once.
export const ELECTRUM_REACHABILITY_TTL_MS = 60_000
