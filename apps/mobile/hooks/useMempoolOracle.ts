import { useMemo } from 'react'

import { MempoolOracle } from '@/api/blockchain'
import { useBlockchainStore } from '@/store/blockchain'
import { type Network } from '@/types/settings/blockchain'

export default function useMempoolOracle(network: Network = 'bitcoin') {
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool[network]
  )
  const mempoolOracle = useMemo(
    () => new MempoolOracle(mempoolUrl),
    [mempoolUrl]
  )
  return mempoolOracle
}
