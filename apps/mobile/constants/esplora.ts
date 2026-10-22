// over 50 transactions (default) -> rate limit -> needs multiple requests.
// TODO: figure out custom server per page
export const ESPLORA_ADDRESS_TXS_PER_REQUEST = 50

// Confirmed txs per address history page: Blockstream's esplora returns 25,
// mempool.space 50. A page holding at least this many may have more after it.
export const ESPLORA_MIN_CHAIN_TXS_PER_PAGE = 25

export const ESPLORA_ERROR_MESSAGES = [
  {
    error: 'timeout',
    reason: 'Connection timeout - server may be slow or unreachable'
  },
  {
    error: 'Unable to resolve host',
    reason: 'Unable to resolve host - check server URL and internet connection'
  },
  {
    error: 'ECONNREFUSED',
    reason: 'Connection refused - server may be down or port is closed'
  },
  {
    error: 'ENOTFOUND',
    reason: 'Server not found - check the server URL'
  },
  {
    error: 'InvalidCertificate',
    reason: 'TLS certificate validation failed - check server configuration'
  },
  {
    error: 'NetworkError',
    reason: 'Network error - check your internet connection'
  }
]
