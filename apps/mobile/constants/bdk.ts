// Cap Zustand/UI updates during BDK RPC scans (inspector fires per block).
export const BDK_RPC_PROGRESS_THROTTLE_MS = 250

// Extended-private-key prefixes across mainnet/testnet and SLIP132 script
// variants (BIP44/49/84/86). Matched case-insensitively against the whole
// descriptor string to detect private key material before it could be sent
// to a remote RPC node.
export const BDK_PRIVATE_EXTENDED_KEY_PREFIXES = [
  'xprv',
  'tprv',
  'yprv',
  'uprv',
  'zprv',
  'vprv'
]

export const BDK_SECONDS_PER_BLOCK = 600

// Max attempts / interval while polling Bitcoin Core to confirm a prior
// rescan has stopped before starting a new one.
export const BDK_RESCAN_STOP_POLL_MAX_ATTEMPTS = 40
export const BDK_RESCAN_STOP_POLL_INTERVAL_MS = 500

// How long to wait for `rescanblockchain` to return before assuming it's
// still running in the background and falling back to polling.
export const BDK_RESCAN_START_RACE_TIMEOUT_MS = 60_000

// Poll `getwalletinfo.scanning` until the rescan completes (max ~6 hours).
export const BDK_RESCAN_MAX_POLLS = 2160
export const BDK_RESCAN_POLL_INTERVAL_MS = 3000
export const BDK_RESCAN_POLL_MAX_CONSECUTIVE_ERRORS = 5
