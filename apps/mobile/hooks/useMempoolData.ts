import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import {
  fetchMempoolBasicData,
  fetchMempoolExtendedData
} from '@/api/explorerMempool'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import {
  retryExplorerQuery,
  withExplorerTimeout
} from '@/utils/explorerTimeout'
import { time } from '@/utils/time'

export function useMempoolBasicData() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]

  return useQuery({
    queryFn: () =>
      withExplorerTimeout(
        fetchMempoolBasicData(
          server.url,
          server.backend,
          selectedNetwork,
          server.rpcCredentials
        ),
        server.url
      ),
    queryKey: [
      'mempool-basic',
      server.url,
      server.backend,
      selectedNetwork,
      server.rpcCredentials?.username
    ],
    retry: retryExplorerQuery,
    staleTime: time.minutes(2)
  })
}

export function useMempoolExtendedData(enabled: boolean) {
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const oracle = useMempoolOracle(selectedNetwork)

  return useQuery({
    enabled,
    queryFn: () =>
      withExplorerTimeout(fetchMempoolExtendedData(oracle), oracle.baseUrl),
    queryKey: ['mempool-extended', selectedNetwork],
    retry: retryExplorerQuery,
    staleTime: time.minutes(2)
  })
}
