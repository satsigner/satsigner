// Bitcoin Core `estimatesmartfee` confirmation-target block counts.
export const FEE_ESTIMATE_TARGET_FAST_BLOCKS = 1
export const FEE_ESTIMATE_TARGET_MEDIUM_BLOCKS = 3
export const FEE_ESTIMATE_TARGET_SLOW_BLOCKS = 6

// Explorer requests give up after this, so a dead or stalled server ends in
// an error instead of an endless spinner.
export const EXPLORER_REQUEST_TIMEOUT_MS = 30_000
// Reaching an onion service builds a Tor circuit first.
export const EXPLORER_REQUEST_TOR_TIMEOUT_MS = 90_000
// One retry absorbs a blip without multiplying the wait on a dead server.
export const EXPLORER_QUERY_RETRY = 1

export const BITNODES_API = 'https://bitnodes.io/api/v1'
export const BITNODES_SNAPSHOT_NODES_LIMIT = 500
export const BITNODES_TOP_VERSIONS_LIMIT = 10
export const BITNODES_TOP_COUNTRIES_LIMIT = 15
