import NetInfo from '@react-native-community/netinfo'
import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import { MS_PER_SECOND } from '@/constants/time'
import { useAsyncEffect } from '@/hooks/useAsyncEffect'
import { queryClient } from '@/lib/queryClient'
import { useBlockchainStore } from '@/store/blockchain'
import { type Config, type Server } from '@/types/settings/blockchain'
import {
  isConnectionPollSuppressed,
  subscribeToConnectionPollSuppression
} from '@/utils/connectionPollSuppression'
import { trimOnionAddress } from '@/utils/format'
import { getServerPrivacy, isOnionUrl } from '@/utils/serverPrivacy'

/** `idle`: manual connection mode, so the server is not being checked. */
export type ConnectionVerifyStatus =
  | 'checking'
  | 'connected'
  | 'failed'
  | 'idle'

const VERIFY_CONNECTION_QUERY_KEY = 'verifyConnection'

const NETINFO_RECONNECT_DELAY_MS = 5000

/**
 * Last NetInfo reading, shared by every mounted indicator so a newly mounted
 * one does not reset the shared status to checking. `null` until first read.
 */
const deviceConnectivity: { isConnected: boolean | null } = {
  isConnected: null
}

async function readDeviceConnectivity() {
  const state = await NetInfo.fetch()
  deviceConnectivity.isConnected = state.isConnected
}

async function testServerConnection(
  server: Server,
  config: Config
): Promise<ConnectionVerifyStatus> {
  try {
    let ok: boolean
    if (server.backend === 'electrum') {
      ok = await ElectrumClient.test(
        server.url,
        server.network,
        config.timeout * MS_PER_SECOND
      )
    } else if (server.backend === 'rpc') {
      ok = await BitcoinRpc.test(
        server.url,
        server.rpcCredentials?.username ?? '',
        server.rpcCredentials?.password ?? '',
        config.timeout * MS_PER_SECOND
      )
    } else {
      ok = await Esplora.test(server.url, config.timeout * MS_PER_SECOND)
    }
    return ok ? 'connected' : 'failed'
  } catch {
    return 'failed'
  }
}

function useVerifyConnection() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const { server, config } = configs[selectedNetwork]

  const pollSuppressed = useSyncExternalStore(
    subscribeToConnectionPollSuppression,
    () => isConnectionPollSuppressed(selectedNetwork)
  )

  const { data: connectionStatus = 'checking', refetch } =
    useQuery<ConnectionVerifyStatus>({
      enabled: config.connectionMode !== 'manual' && !pollSuppressed,
      gcTime: 0,
      queryFn: async () => {
        if (deviceConnectivity.isConnected === null) {
          return 'checking'
        }
        if (deviceConnectivity.isConnected === false) {
          return 'failed'
        }
        return await testServerConnection(server, config)
      },
      queryKey: [
        VERIFY_CONNECTION_QUERY_KEY,
        selectedNetwork,
        server.url,
        server.backend,
        server.network,
        config.timeout,
        config.connectionMode,
        server.rpcCredentials?.username,
        server.rpcCredentials?.password
      ],
      refetchInterval: config.connectionTestInterval * MS_PER_SECOND,
      refetchIntervalInBackground: true,
      refetchOnMount: 'always'
    })

  // Every indicator runs these on mount; a refetch that cancels the one in
  // flight would start one server test per indicator.
  useAsyncEffect(async () => {
    if (config.connectionMode === 'manual') {
      return
    }

    await readDeviceConnectivity()
    refetch({ cancelRefetch: false })

    return NetInfo.addEventListener((netInfoState) => {
      const next = netInfoState.isConnected
      if (deviceConnectivity.isConnected === next) {
        return
      }
      deviceConnectivity.isConnected = next
      if (next === true) {
        setTimeout(() => {
          refetch()
        }, NETINFO_RECONNECT_DELAY_MS)
      } else if (next === false) {
        refetch()
      }
    })
  }, [config.connectionMode, refetch])

  useAsyncEffect(async () => {
    await readDeviceConnectivity()
    refetch({ cancelRefetch: false })
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

  const status: ConnectionVerifyStatus =
    config.connectionMode === 'manual' ? 'idle' : connectionStatus

  return [
    status,
    connectionString,
    getServerPrivacy(server),
    { ...connectionParts, isOnion: isOnionUrl(server.url) }
  ] as const
}

/**
 * A sync just failed to reach the server: show it right away instead of
 * waiting for the next periodic check.
 */
export function markServerConnectionFailed() {
  queryClient.setQueriesData<ConnectionVerifyStatus>(
    { queryKey: [VERIFY_CONNECTION_QUERY_KEY] },
    'failed'
  )
}

export default useVerifyConnection
