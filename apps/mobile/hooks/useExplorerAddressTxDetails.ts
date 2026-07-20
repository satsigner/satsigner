import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  fetchExplorerAddressTxDetailsFromBackend,
  fetchExplorerAddressTxDetailsFromMempool
} from '@/api/explorerAddress'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import { time } from '@/utils/time'

type UseExplorerAddressTxDetailsArgs = {
  address: string | null
  txids: string[]
  /** Prefer mempool when the address itself was loaded from mempool.space. */
  preferMempool?: boolean
}

export function useExplorerAddressTxDetails({
  address,
  txids,
  preferMempool = false
}: UseExplorerAddressTxDetailsArgs) {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const oracle = useMempoolOracle(selectedNetwork)
  const [requested, setRequested] = useState(false)
  const [useMempool, setUseMempool] = useState(false)

  const trimmed = address?.trim() ?? ''
  const ready = trimmed.length > 20
  const mempoolEnabled = useMempool || preferMempool

  const query = useQuery({
    enabled: ready && requested,
    queryFn: () => {
      if (mempoolEnabled) {
        return fetchExplorerAddressTxDetailsFromMempool(trimmed, oracle)
      }
      return fetchExplorerAddressTxDetailsFromBackend(
        trimmed,
        server.url,
        server.backend,
        selectedNetwork,
        txids
      )
    },
    queryKey: [
      'explorer-address-tx-details',
      trimmed,
      server.backend,
      server.url,
      mempoolEnabled,
      selectedNetwork,
      txids.slice(0, 50).join(',')
    ],
    retry: false,
    staleTime: time.minutes(2)
  })

  function loadDetails() {
    if (!trimmed) {
      return
    }
    setRequested(true)
  }

  function loadDetailsFromMempool() {
    if (!trimmed) {
      return
    }
    setUseMempool(true)
    setRequested(true)
  }

  return {
    ...query,
    loadDetails,
    loadDetailsFromMempool,
    requested,
    useMempool: mempoolEnabled
  }
}
