import NetInfo from '@react-native-community/netinfo'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { servers } from '@/constants/servers'
import { useBlockchainStore } from '@/store/blockchain'

function useVerifyConnection() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const { server, config } = configs[selectedNetwork]

  const isConnectionAvailable = useRef<boolean | null>(false)
  const [connectionState, setConnectionState] = useState<boolean>(false)
  const connectionString = useMemo(() => {
    if (config.connectionMode === 'auto')
      return `${server.network} - ${server.url}`

    return `${server.network} - ${server.url} (${config.connectionMode})`
  }, [server.network, server.url, config.connectionMode])

  const isPrivateConnection = useMemo(() => {
    if (servers.findIndex((val) => val.url === server.url) === -1) {
      return false
    }
    return true
  }, [server.url])

  const verifyConnection = useCallback(async () => {
    if (!isConnectionAvailable.current || config.connectionMode === 'manual') {
      setConnectionState(false)
      return
    }
    try {
      const result =
        server.backend === 'electrum'
          ? await ElectrumClient.test(
              server.url,
              server.network,
              config.timeout * 1000
            )
          : await Esplora.test(server.url, config.timeout * 1000)
      setConnectionState(result)
    } catch {
      setConnectionState(false)
    }
  }, [
    server.backend,
    server.network,
    config.timeout,
    server.url,
    config.connectionMode
  ])

  const checkConnection = useCallback(async () => {
    if (config.connectionMode === 'manual') return

    const state = await NetInfo.fetch()
    isConnectionAvailable.current = state.isConnected
  }, [config.connectionMode])

  useEffect(() => {
    if (config.connectionMode === 'manual') return
    ;(async () => {
      await checkConnection()
      verifyConnection()
    })()

    const timerId = setInterval(() => {
      verifyConnection()
      // INFO: we store the interval in seconds but the function expects the
      // timeout interval to be in miliseconds
    }, config.connectionTestInterval * 1000)

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (
        isConnectionAvailable.current !== state.isConnected &&
        state.isConnected !== null
      ) {
        isConnectionAvailable.current = state.isConnected
        if (state.isConnected) {
          setTimeout(verifyConnection, 5000)
        } else {
          verifyConnection()
        }
      } else {
        isConnectionAvailable.current = state.isConnected
      }
    })

    return () => {
      unsubscribe()
      clearInterval(timerId)
    }
  }, [
    checkConnection,
    verifyConnection,
    config.connectionMode,
    config.connectionTestInterval
  ])

  useEffect(() => {
    verifyConnection()
  }, [server.url, verifyConnection])

  return [connectionState, connectionString, isPrivateConnection]
}

export default useVerifyConnection
