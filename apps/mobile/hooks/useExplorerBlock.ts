import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  fetchExplorerBlock,
  fetchExplorerBlockFromMempool,
  fetchExplorerTipHeight
} from '@/api/explorerBlock'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import { time } from '@/utils/time'

export function useExplorerBlock(height: number | null) {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const { url: backendUrl, backend, rpcCredentials } = server
  const oracle = useMempoolOracle(selectedNetwork)
  const [useMempool, setUseMempool] = useState(false)
  const [mempoolForHeight, setMempoolForHeight] = useState<number | null>(null)

  const ready = height !== null && Number.isInteger(height) && height >= 0
  const resolvedHeight = ready ? height : null
  const mempoolEnabled = useMempool && mempoolForHeight === resolvedHeight

  const tipQuery = useQuery({
    queryFn: () => fetchExplorerTipHeight(backendUrl, backend, rpcCredentials),
    queryKey: ['explorer-tip-height', backend, backendUrl, selectedNetwork],
    staleTime: time.minutes(1)
  })

  const query = useQuery({
    enabled: resolvedHeight !== null,
    queryFn: () => {
      if (resolvedHeight === null) {
        throw new Error('Block height is required')
      }
      if (mempoolEnabled) {
        return fetchExplorerBlockFromMempool(resolvedHeight, oracle)
      }
      return fetchExplorerBlock(
        backendUrl,
        backend,
        resolvedHeight,
        rpcCredentials
      )
    },
    queryKey: [
      'explorer-block',
      resolvedHeight,
      backend,
      backendUrl,
      mempoolEnabled,
      selectedNetwork
    ],
    staleTime: time.minutes(2)
  })

  function loadFromMempool() {
    if (resolvedHeight === null) {
      return
    }
    setMempoolForHeight(resolvedHeight)
    setUseMempool(true)
  }

  return {
    ...query,
    backend,
    height: resolvedHeight,
    loadFromMempool,
    maxBlockHeight: tipQuery.data ?? null,
    ready,
    server,
    useMempool: mempoolEnabled
  }
}
