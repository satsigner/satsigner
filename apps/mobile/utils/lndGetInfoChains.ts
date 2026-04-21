import { type LNDGetInfoChain } from '@/types/models/LND'

function chainEntryToLabel(entry: string | LNDGetInfoChain): string {
  if (typeof entry === 'string') {
    return entry
  }
  const c = entry.chain?.trim() ?? ''
  const n = entry.network?.trim() ?? ''
  if (c && n) {
    return `${c}/${n}`
  }
  return c || n
}

/** Human-readable list for settings / debug (supports legacy string[] if ever present). */
export function formatLndChainsForUi(
  chains?: readonly (string | LNDGetInfoChain)[] | null
): string {
  if (!chains?.length) {
    return ''
  }
  return chains.map(chainEntryToLabel).join(', ')
}

/**
 * Lowercase hint for mempool URL choice (testnet/mainnet/regtest).
 * LND returns `chains: [{ chain, network }]`, not plain strings.
 */
export function lndChainsExplorerNetworkHint(
  chains?: readonly (string | LNDGetInfoChain)[] | null
): string {
  if (!chains?.length) {
    return ''
  }
  const [first] = chains
  if (typeof first === 'string') {
    return first.toLowerCase()
  }
  return `${first.chain ?? ''} ${first.network ?? ''}`.toLowerCase()
}

/** Mempool.space URL for a funding tx, or null when unsupported (regtest/simnet). */
export function getLndFundingTxMempoolUrl(
  txid: string,
  chains?: readonly (string | LNDGetInfoChain)[] | null
): string | null {
  if (!txid.trim()) {
    return null
  }
  const c = lndChainsExplorerNetworkHint(chains)
  if (c.includes('regtest') || c.includes('simnet')) {
    return null
  }
  if (c.includes('testnet') || c.includes('signet')) {
    return `https://mempool.space/testnet/tx/${txid}`
  }
  return `https://mempool.space/tx/${txid}`
}
