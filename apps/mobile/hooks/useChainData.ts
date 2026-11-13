import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import { fetchChainData } from '@/api/explorerChain'
import { useBlockchainStore } from '@/store/blockchain'
import {
  retryExplorerQuery,
  withExplorerTimeout
} from '@/utils/explorerTimeout'
import { time } from '@/utils/time'

export function useChainData() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]

  return useQuery({
    queryFn: () =>
      withExplorerTimeout(fetchChainData(server, selectedNetwork), server.url),
    queryKey: [
      'chain-data',
      server.url,
      server.backend,
      selectedNetwork,
      server.rpcCredentials?.username
    ],
    retry: retryExplorerQuery,
    staleTime: time.minutes(1)
  })
}
