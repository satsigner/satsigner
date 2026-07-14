import NetInfo from '@react-native-community/netinfo'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import { servers } from '@/constants/servers'
import { useBlockchainStore } from '@/store/blockchain'
import { isConnectionPollSuppressed } from '@/utils/connectionPollSuppression'
import { trimOnionAddress } from '@/utils/format'

export type ConnectionVerifyStatus = 'checking' | 'connected' | 'failed'

const NETINFO_RECONNECT_DELAY_MS = 5000

function useVerifyConnection() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const { server, config } = configs[selectedNetwork]

  /** `null` until first NetInfo read — avoids showing failed before we know online state */
  const isConnectionAvailable = useRef<boolean | null>(null)

  const { data: connectionStatus = 'checking', refetch } =
    useQuery<ConnectionVerifyStatus>({
      enabled:
        config.connectionMode !== 'manual' &&
        !isConnectionPollSuppressed(selectedNetwork),
      gcTime: 0,
      queryFn: async () => {
        if (isConnectionAvailable.current === null) {
          return 'checking'
        }
        if (isConnectionAvailable.current === false) {
          return 'failed'
        }
        try {
          let ok: boolean
          if (server.backend === 'electrum') {
            ok = await ElectrumClient.test(
              server.url,
              server.network,
              config.timeout * 1000
            )
          } else if (server.backend === 'rpc') {
            ok = await BitcoinRpc.test(
              server.url,
              server.rpcCredentials?.username ?? '',
              server.rpcCredentials?.password ?? '',
              config.timeout * 1000
            )
          } else {
            ok = await Esplora.test(server.url, config.timeout * 1000)
          }
          return ok ? 'connected' : 'failed'
        } catch {
          return 'failed'
        }
      },
      queryKey: [
        'verifyConnection',
        selectedNetwork,
        server.url,
        server.backend,
        server.network,
        config.timeout,
        config.connectionMode,
        server.rpcCredentials?.username,
        server.rpcCredentials?.password
      ],
      refetchInterval: config.connectionTestInterval * 1000,
      refetchIntervalInBackground: true,
      refetchOnMount: 'always'
    })

  useEffect(() => {
    if (config.connectionMode === 'manual') {
      return
    }

    let cancelled = false

    ;(async () => {
      const state = await NetInfo.fetch()
      if (cancelled) {
        return
      }
      isConnectionAvailable.current =
        state.isConnected === null ? null : state.isConnected
      refetch()
    })()

    const unsubscribe = NetInfo.addEventListener((state) => {
      const next = state.isConnected === null ? null : state.isConnected
      if (isConnectionAvailable.current === next) {
        return
      }
      isConnectionAvailable.current = next
      if (next === true) {
        setTimeout(() => {
          refetch()
        }, NETINFO_RECONNECT_DELAY_MS)
      } else if (next === false) {
        refetch()
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [config.connectionMode, refetch])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const state = await NetInfo.fetch()
      if (cancelled) {
        return
      }
      isConnectionAvailable.current =
        state.isConnected === null ? null : state.isConnected
      refetch()
    })()
    return () => {
      cancelled = true
    }
  }, [server.url, refetch])

  const trimmedUrl = trimOnionAddress(server.url)
  const connectionString =
    config.connectionMode === 'auto'
      ? `${server.network} - ${server.name} (${trimmedUrl})`
      : `${server.network} - ${server.name} (${trimmedUrl}) [${config.connectionMode}]`

  const connectionParts = {
    mode: config.connectionMode !== 'auto' ? config.connectionMode : null,
    name: server.name,
    network: server.network,
    url: trimmedUrl
  }

  const isPrivateConnection = servers.some((val) => val.url === server.url)

  return [
    connectionStatus,
    connectionString,
    isPrivateConnection,
    connectionParts
  ] as const
}

export default useVerifyConnection
