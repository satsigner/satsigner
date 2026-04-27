import NetInfo from '@react-native-community/netinfo'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { servers } from '@/constants/servers'
import { useBlockchainStore } from '@/store/blockchain'
import { trimOnionAddress } from '@/utils/format'

export type ConnectionVerifyStatus = 'checking' | 'connected' | 'failed'

function useVerifyConnection() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const { server, config } = configs[selectedNetwork]

  /** `null` until first NetInfo read — avoids showing failed before we know online state */
  const isConnectionAvailable = useRef<boolean | null>(null)
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionVerifyStatus>('checking')

  useEffect(() => {
    setConnectionStatus('checking')
  }, [selectedNetwork, server.url, server.backend])
  const connectionString = useMemo(() => {
    const trimmedUrl = trimOnionAddress(server.url)
    if (config.connectionMode === 'auto') {
      return `${server.network} - ${server.name} (${trimmedUrl})`
    }

    return `${server.network} - ${server.name} (${trimmedUrl}) [${config.connectionMode}]`
  }, [server.network, server.name, server.url, config.connectionMode])

  const connectionParts = useMemo(() => {
    const trimmedUrl = trimOnionAddress(server.url)
    return {
      mode: config.connectionMode !== 'auto' ? config.connectionMode : null,
      name: server.name,
      network: server.network,
      url: trimmedUrl
    }
  }, [server.network, server.name, server.url, config.connectionMode])

  const isPrivateConnection = useMemo(() => {
    if (!servers.some((val) => val.url === server.url)) {
      return false
    }
    return true
  }, [server.url])

  const verifyConnection = useCallback(async () => {
    const networkAtStart = selectedNetwork
    const urlAtStart = server.url
    const backendAtStart = server.backend

    function isStale() {
      const s = useBlockchainStore.getState()
      return (
        s.selectedNetwork !== networkAtStart ||
        s.configs[networkAtStart].server.url !== urlAtStart ||
        s.configs[networkAtStart].server.backend !== backendAtStart
      )
    }

    if (isConnectionAvailable.current === null) {
      if (!isStale()) {
        setConnectionStatus('checking')
      }
      return
    }

    if (isConnectionAvailable.current === false) {
      if (!isStale()) {
        setConnectionStatus('failed')
      }
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

      if (isStale()) {
        return
      }
      setConnectionStatus(result ? 'connected' : 'failed')
    } catch {
      if (isStale()) {
        return
      }
      setConnectionStatus('failed')
    }
  }, [
    selectedNetwork,
    server.backend,
    server.network,
    config.timeout,
    server.url
  ])

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch()
    isConnectionAvailable.current =
      state.isConnected === null ? null : state.isConnected
  }, [])

  useEffect(() => {
    if (config.connectionMode === 'manual') {
      return
    }
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
      const next = state.isConnected === null ? null : state.isConnected
      if (isConnectionAvailable.current === next) {
        return
      }
      isConnectionAvailable.current = next
      if (next === true) {
        setTimeout(verifyConnection, 5000)
      } else if (next === false) {
        verifyConnection()
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
    let cancelled = false
    ;(async () => {
      await checkConnection()
      if (cancelled) {
        return
      }
      verifyConnection()
    })()
    return () => {
      cancelled = true
    }
  }, [server.url, verifyConnection, checkConnection])

  return [
    connectionStatus,
    connectionString,
    isPrivateConnection,
    connectionParts
  ] as const
}

export default useVerifyConnection
