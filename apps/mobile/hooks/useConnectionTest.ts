import { useCallback, useEffect, useState } from 'react'

import ElectrumClient, { closeElectrumClientQuietly } from '@/api/electrum'
import { probeConnection, SOFTWARE_LABELS } from '@/services/connectionTest'
import {
  type ConnectionTestResult,
  type NodeInfo
} from '@/types/models/ConnectionTest'
import {
  type Backend,
  type Network,
  type ProxyConfig,
  type RpcCredentials
} from '@/types/settings/blockchain'

const CONNECTION_TEST_COOLDOWN_MS = 2000
const CONNECTION_TEST_TIMEOUT_MS = 10_000

function rejectAfterTimeout(): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(
      () => reject(new Error('Connection test timeout')),
      CONNECTION_TEST_TIMEOUT_MS
    )
  })
}

export function useConnectionTest() {
  const [testing, setTesting] = useState(false)
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null)
  const [currentClient, setCurrentClient] = useState<ElectrumClient | null>(
    null
  )
  const [lastTestTime, setLastTestTime] = useState<number>(0)

  const cleanupPreviousConnection = useCallback(() => {
    if (!currentClient) {
      return
    }
    closeElectrumClientQuietly(currentClient)
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
    setNodeInfo(null)

    try {
      const probe = await Promise.race([
        probeConnection({
          backend,
          network,
          onElectrumClient: setCurrentClient,
          rpcCredentials,
          url
        }),
        rejectAfterTimeout()
      ])
      setNodeInfo(probe.nodeInfo)
      return probe.result
    } catch (error) {
      setNodeInfo({
        network,
        responseTime: Date.now() - now,
        software: SOFTWARE_LABELS[backend]
      })
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
    setNodeInfo(null)
  }

  useEffect(
    () => () => {
      cleanupPreviousConnection()
    },
    [cleanupPreviousConnection]
  )

  return {
    nodeInfo,
    resetTest,
    testConnection,
    testing
  }
}
