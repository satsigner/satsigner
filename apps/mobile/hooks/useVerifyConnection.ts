import NetInfo from '@react-native-community/netinfo'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { servers } from '@/constants/servers'
import { useBlockchainStore } from '@/store/blockchain'

function useVerifyConnection() {
  const [backend, network, url, timeout] = useBlockchainStore(
    useShallow((state) => [
      state.backend,
      state.network,
      state.url,
      state.timeout * 1000
    ])
  )

  const isConnectionAvailable = useRef<boolean | null>(false)
  const [connectionState, setConnectionState] = useState<boolean>(false)
  const connectionString = useMemo(() => {
    return network + ' - ' + url
  }, [network, url])

  const isPrivateConnection = useMemo(() => {
    if (servers.findIndex((val) => val.url === url) === -1) {
      return false
    }
    return true
  }, [url])

  const verifyConnection = useCallback(async () => {
    if (!isConnectionAvailable.current) {
      setConnectionState(false)
      return
    }
    try {
      const result =
        backend === 'electrum'
          ? await ElectrumClient.test(url, network, timeout)
          : await Esplora.test(url, timeout)
      setConnectionState(result)
    } catch {
      setConnectionState(false)
    }
  }, [backend, network, timeout, url])

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch()
    isConnectionAvailable.current = state.isConnected
  }, [])

  useEffect(() => {
    ;(async () => {
      await checkConnection()
      verifyConnection()
    })()
    const timerId = setInterval(() => {
      verifyConnection()
    }, 60000)

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
  }, [checkConnection, verifyConnection])

  useEffect(() => {
    verifyConnection()
  }, [url, verifyConnection])

  return [connectionState, connectionString, isPrivateConnection]
}

export default useVerifyConnection
