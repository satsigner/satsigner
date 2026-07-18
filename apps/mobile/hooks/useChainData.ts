import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import { fetchChainData } from '@/api/explorerChain'
import { useBlockchainStore } from '@/store/blockchain'
import { time } from '@/utils/time'

export function useChainData() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]

  return useQuery({
    queryFn: () => fetchChainData(server, selectedNetwork),
    queryKey: [
      'chain-data',
      server.url,
      server.backend,
      selectedNetwork,
      server.rpcCredentials?.username
    ],
    staleTime: time.minutes(1)
  })
}
