import { useMemo } from 'react'

import { MempoolOracle } from '@/api/blockchain'
import { useBlockchainStore } from '@/store/blockchain'
import { type Network } from '@/types/settings/blockchain'

const DEFAULT_MEMPOOL_API: Record<Network, string> = {
  bitcoin: 'https://mempool.space/api',
  signet: 'https://mempool.space/signet/api',
  testnet: 'https://mempool.space/testnet4/api'
}

function normalizeMempoolApiUrl(url: string, network: Network): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (trimmed.length === 0) {
    return DEFAULT_MEMPOOL_API[network]
  }
  if (trimmed.endsWith('/api')) {
    return trimmed
  }
  return `${trimmed}/api`
}

export default function useMempoolOracle(network: Network = 'bitcoin') {
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool[network]
  )
  const mempoolOracle = useMemo(
    () => new MempoolOracle(normalizeMempoolApiUrl(mempoolUrl, network)),
    [mempoolUrl, network]
  )
  return mempoolOracle
}
