import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import {
  fetchBackendServerInfo,
  fetchBitnodesNetworkStats,
  fetchBitnodesNodeInfo
} from '@/api/explorerNode'
import { useBlockchainStore } from '@/store/blockchain'
import { time } from '@/utils/time'

export function useBackendServerInfo() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const supportsServerInfo =
    (server.backend === 'electrum' || server.backend === 'rpc') &&
    Boolean(server.url)

  return useQuery({
    enabled: supportsServerInfo,
    queryFn: () =>
      fetchBackendServerInfo(
        server.url,
        server.backend,
        selectedNetwork,
        server.rpcCredentials
      ),
    queryKey: [
      'backend-server-info',
      server.url,
      server.backend,
      selectedNetwork,
      server.rpcCredentials?.username
    ],
    staleTime: time.minutes(30)
  })
}

/** @deprecated Prefer useBackendServerInfo */
export function useElectrumServerInfo() {
  return useBackendServerInfo()
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
