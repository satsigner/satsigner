import { useMemo } from 'react'

import { MempoolOracle } from '@/api/blockchain'
import { MempoolServers } from '@/constants/servers'
import { useBlockchainStore } from '@/store/blockchain'
import { type Network } from '@/types/settings/blockchain'

function normalizeMempoolApiUrl(url: string, network: Network): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (trimmed.length === 0) {
    return MempoolServers[network]
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
