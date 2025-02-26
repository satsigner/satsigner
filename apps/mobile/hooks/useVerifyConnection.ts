import NetInfo from '@react-native-community/netinfo'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useBlockchainStore } from '@/store/blockchain'

function useVerifyConnection() {
  const [network, url, timeout, backend] = useBlockchainStore(
    useShallow((state) => [
      state.network,
      state.url,
      state.timeout * 1000,
      state.backend
    ])
  )

  const isConnectionAvailable = useRef<boolean | null>(false)
  const [connectionState, setConnectionState] = useState<boolean>(false)
  const connectionString = useMemo(() => {
    return backend + ' : ' + network + ' - ' + url
  }, [backend, network, url])

  const verifyUrl = useMemo(() => {
    const urlObj = new URL(url)
    if (urlObj.protocol === 'ssl:') {
      const modifiedUrl = new URL(url.replace('ssl://', 'https://'))
      modifiedUrl.port = ''
      modifiedUrl.pathname = `/${network === 'bitcoin' ? '' : `${network}/`}api/v1/difficulty-adjustment`
      return modifiedUrl.toString()
    } else {
      urlObj.pathname = '/api/v1/difficulty-adjustment'
    }
    return urlObj.toString()
  }, [network, url])

  const isPrivateConnection = useMemo(() => {
    if (
      url === 'ssl://mempool.space:60602' ||
      url === 'https://mutinynet.com/api'
    ) {
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
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
      )
      const fetchPromise = fetch(verifyUrl)
      const response = (await Promise.race([
        timeoutPromise,
        fetchPromise
      ])) as Response
      if (!isConnectionAvailable.current) {
        setConnectionState(false)
        return
      }
      if (response.ok) {
        setConnectionState(true)
      } else {
        setConnectionState(false)
      }
    } catch (_) {
      setConnectionState(false)
    }
  }, [timeout, verifyUrl])

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

  return [connectionState, connectionString, isPrivateConnection]
}

export default useVerifyConnection
