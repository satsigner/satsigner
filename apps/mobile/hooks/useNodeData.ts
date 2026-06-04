import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import {
  fetchBitnodesNetworkStats,
  fetchBitnodesNodeInfo,
  fetchElectrumServerInfo
} from '@/api/explorerNode'
import { useBlockchainStore } from '@/store/blockchain'
import { time } from '@/utils/time'

export function useElectrumServerInfo() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const isElectrum = server.backend === 'electrum' && Boolean(server.url)

  return useQuery({
    enabled: isElectrum,
    queryFn: () => fetchElectrumServerInfo(server.url, selectedNetwork),
    queryKey: ['electrum-server-info', server.url, selectedNetwork],
    staleTime: time.minutes(30)
  })
}

export function useBitnodesNodeInfo(enabled: boolean) {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]

  return useQuery({
    enabled: enabled && Boolean(server.url),
    queryFn: () => fetchBitnodesNodeInfo(server.url),
    queryKey: ['bitnodes-node', server.url],
    staleTime: time.hours(1)
  })
}

export function useBitnodesNetworkStats(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: fetchBitnodesNetworkStats,
    queryKey: ['bitnodes-network'],
    staleTime: time.hours(1)
  })
}
