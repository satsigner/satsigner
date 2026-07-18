import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  fetchBlockTxidsFromBackend,
  fetchBlockTxidsFromMempool
} from '@/api/explorerBlockTransactions'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import { getExplorerCapability } from '@/utils/explorerCapabilities'
import { time } from '@/utils/time'

export function useExplorerBlockTransactions(blockHash: string | undefined) {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const oracle = useMempoolOracle(selectedNetwork)
  const [useMempool, setUseMempool] = useState(false)
  const [mempoolForBlock, setMempoolForBlock] = useState<string | null>(null)

  const capability = getExplorerCapability(server.backend, 'blockTxList')
  const backendSupported = capability.available
  const mempoolEnabled =
    useMempool && blockHash !== undefined && mempoolForBlock === blockHash

  const query = useQuery({
    enabled: Boolean(blockHash) && (backendSupported || mempoolEnabled),
    queryFn: () => {
      if (!blockHash) {
        throw new Error('missing_block_hash')
      }
      if (mempoolEnabled) {
        return fetchBlockTxidsFromMempool(blockHash, oracle)
      }
      return fetchBlockTxidsFromBackend(
        blockHash,
        server.url,
        server.backend,
        server.rpcCredentials
      )
    },
    queryKey: [
      'explorer-block-txids',
      blockHash,
      server.backend,
      server.url,
      mempoolEnabled,
      selectedNetwork
    ],
    staleTime: time.minutes(5)
  })

  function loadFromMempool() {
    if (!blockHash) {
      return
    }
    setMempoolForBlock(blockHash)
    setUseMempool(true)
  }

  return {
    ...query,
    backendSupported,
    capability,
    loadFromMempool,
    server,
    useMempool: mempoolEnabled
  }
}
