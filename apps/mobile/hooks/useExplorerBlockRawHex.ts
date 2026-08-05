import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  fetchExplorerBlockRawHex,
  fetchExplorerBlockRawHexFromMempool
} from '@/api/explorerBlock'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import { getExplorerCapability } from '@/utils/explorerCapabilities'
import { time } from '@/utils/time'

export function useExplorerBlockRawHex(blockHash: string | null) {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const { url: backendUrl, backend, rpcCredentials } = server
  const oracle = useMempoolOracle(selectedNetwork)
  const [useMempool, setUseMempool] = useState(false)
  const [mempoolForHash, setMempoolForHash] = useState<string | null>(null)

  const capability = getExplorerCapability(backend, 'rawBlock')
  const ready = Boolean(blockHash)
  const mempoolEnabled = useMempool && mempoolForHash === blockHash
  const enabled = ready && (capability.available || mempoolEnabled)

  const query = useQuery({
    enabled,
    queryFn: () => {
      if (!blockHash) {
        throw new Error('Block hash is required')
      }
      if (mempoolEnabled) {
        return fetchExplorerBlockRawHexFromMempool(blockHash, oracle)
      }
      return fetchExplorerBlockRawHex(
        blockHash,
        backendUrl,
        backend,
        rpcCredentials
      )
    },
    queryKey: [
      'explorer-block-raw-hex',
      blockHash,
      backend,
      backendUrl,
      mempoolEnabled,
      selectedNetwork
    ],
    staleTime: time.minutes(10)
  })

  function loadFromMempool() {
    if (!blockHash) {
      return
    }
    setMempoolForHash(blockHash)
    setUseMempool(true)
  }

  return {
    ...query,
    capability,
    loadFromMempool,
    server,
    useMempool: mempoolEnabled
  }
}
