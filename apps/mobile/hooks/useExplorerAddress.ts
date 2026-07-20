import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  fetchExplorerAddressFromBackend,
  fetchExplorerAddressFromMempool
} from '@/api/explorerAddress'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import { getExplorerCapability } from '@/utils/explorerCapabilities'
import { time } from '@/utils/time'

export function useExplorerAddress(address: string | null) {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const oracle = useMempoolOracle(selectedNetwork)
  const [useMempool, setUseMempool] = useState(false)
  const [mempoolForAddress, setMempoolForAddress] = useState<string | null>(
    null
  )

  const capability = getExplorerCapability(server.backend, 'addressHistory')
  const backendSupported = capability.available
  const trimmed = address?.trim() ?? ''
  const ready = trimmed.length > 20
  const mempoolEnabled = useMempool && mempoolForAddress === trimmed

  const query = useQuery({
    enabled: ready,
    queryFn: () => {
      if (mempoolEnabled) {
        return fetchExplorerAddressFromMempool(trimmed, oracle)
      }
      return fetchExplorerAddressFromBackend(
        trimmed,
        server.url,
        server.backend,
        selectedNetwork,
        server.rpcCredentials
      )
    },
    queryKey: [
      'explorer-address',
      trimmed,
      server.backend,
      server.url,
      mempoolEnabled,
      selectedNetwork
    ],
    staleTime: time.minutes(2)
  })

  function loadFromMempool() {
    if (!trimmed) {
      return
    }
    setMempoolForAddress(trimmed)
    setUseMempool(true)
  }

  return {
    ...query,
    address: trimmed,
    backendSupported,
    capability,
    loadFromMempool,
    ready,
    server,
    useMempool: mempoolEnabled
  }
}
