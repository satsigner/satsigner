import { useCallback, useEffect, useState } from 'react'

import type ElectrumClient from '@/api/electrum'
import { CONNECTION_TEST_COOLDOWN_MS } from '@/constants/connectionTest'
import { closeProbeClient, probeConnection } from '@/services/connectionTest'
import { type ConnectionTestResult } from '@/types/models/ConnectionTest'
import {
  type Backend,
  type Network,
  type ProxyConfig,
  type RpcCredentials
} from '@/types/settings/blockchain'

export function useConnectionTest() {
  const [testing, setTesting] = useState(false)
  const [currentClient, setCurrentClient] = useState<ElectrumClient | null>(
    null
  )
  const [lastTestTime, setLastTestTime] = useState<number>(0)

  const cleanupPreviousConnection = useCallback(() => {
    if (!currentClient) {
      return
    }
    closeProbeClient(currentClient)
    setCurrentClient(null)
  }, [currentClient])

  async function testConnection(
    url: string,
    backend: Backend,
    network: Network,
    proxy?: ProxyConfig,
    rpcCredentials?: RpcCredentials
  ): Promise<ConnectionTestResult> {
    const now = Date.now()
    if (now - lastTestTime < CONNECTION_TEST_COOLDOWN_MS) {
      return {
        error: 'Please wait before testing another connection',
        success: false
      }
    }

    setLastTestTime(now)
    cleanupPreviousConnection()
    setTesting(true)

    try {
      return await probeConnection({
        backend,
        network,
        onElectrumClientOpened: setCurrentClient,
        rpcCredentials,
        url
      })
    } catch (error) {
      const fallback = proxy?.enabled
        ? 'Proxy connection failed. Ensure Tor/Orbot is running.'
        : 'Unknown connection error'
      return {
        error: error instanceof Error ? error.message : fallback,
        success: false
      }
    } finally {
      setTesting(false)
    }
  }

  function resetTest() {
    cleanupPreviousConnection()
    setTesting(false)
  }

  useEffect(
    () => () => {
      cleanupPreviousConnection()
    },
    [cleanupPreviousConnection]
  )

  return {
    resetTest,
    testConnection,
    testing
  }
}
