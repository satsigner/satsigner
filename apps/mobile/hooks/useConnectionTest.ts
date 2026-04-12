import { useCallback, useEffect, useState } from 'react'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import {
  type Backend,
  type Network,
  type ProxyConfig
} from '@/types/settings/blockchain'

type NodeInfo = {
  version?: string
  blockHeight?: number
  responseTime?: number
  network?: string
  software?: string
  mempoolSize?: number
  chainWork?: string
  medianFee?: number
  hashRate?: string
}

type testResponse = {
  success: boolean
  error?: string
}

export function useConnectionTest() {
  const [testing, setTesting] = useState(false)
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null)
  const [currentClient, setCurrentClient] = useState<
    ElectrumClient | Esplora | null
  >(null)
  const [lastTestTime, setLastTestTime] = useState<number>(0)

  const cleanupPreviousConnection = useCallback(() => {
    if (!currentClient) {
      return
    }

    // close TLS connection. Apply only to Electrum Client
    if ('close' in currentClient && typeof currentClient.close === 'function') {
      currentClient.close()
    }

    setCurrentClient(null)
  }, [currentClient])

  async function testConnection(
    url: string,
    backend: Backend,
    network: Network,
    proxy?: ProxyConfig
  ): Promise<testResponse> {
    // Debounce rapid connection attempts to prevent memory issues
    const now = Date.now()
    if (now - lastTestTime < 2000) {
      return {
        error: 'Please wait before testing another connection',
        success: false
      }
    }

    setLastTestTime(now)
    cleanupPreviousConnection()
    setTesting(true)
    setNodeInfo(null)

    const startTime = Date.now()
    const connectionTimeout = 10_000

    async function testPromise(): Promise<testResponse> {
      if (backend === 'electrum') {
        const client = ElectrumClient.fromUrl(url, network)

        // Store current client for cleanup
        setCurrentClient(client)

        const serverInfo = await client.client.initElectrum(
          { client: 'satsigner', version: '1.4' },
          { callback: null, maxRetry: 0 }
        )

        const responseTime = Date.now() - startTime

        // Try block height via headers subscribe
        let blockHeight = 0
        try {
          const tip = await (
            client.client as unknown as {
              blockchainHeaders_subscribe: () => Promise<{
                height: number
              } | null>
            }
          ).blockchainHeaders_subscribe()
          if (tip?.height) {
            blockHeight = tip.height as number
          }
        } catch {
          // optional — not all servers support headers subscribe
        }

        // Try mempool fee histogram for mempool size
        let mempoolSize
        try {
          const mempoolInfo = await (
            client.client as unknown as {
              mempool_get_fee_histogram?: () => Promise<[number, number][]>
            }
          ).mempool_get_fee_histogram?.()
          if (mempoolInfo && Array.isArray(mempoolInfo)) {
            mempoolSize = mempoolInfo.reduce(
              (sum: number, item: [number, number]) =>
                sum + (Array.isArray(item) && item[1] ? item[1] : 0),
              0
            )
          }
        } catch {
          // optional
        }

        setNodeInfo({
          blockHeight,
          mempoolSize,
          network: network as string,
          responseTime,
          software: (serverInfo as unknown as string[])?.[0] || 'Electrum',
          version: (serverInfo as unknown as string[])?.[1] || 'Unknown'
        })

        try {
          client.close()
        } catch {
          /* silently ignored */
        }

        return {
          success: true
        }
      } else if (backend === 'esplora') {
        // Test Esplora connection and get server info
        const client = new Esplora(url)

        // Store current client for cleanup
        setCurrentClient(client)

        const blockHeight = await client.getLatestBlockHeight()
        const responseTime = Date.now() - startTime

        const mempoolInfo = await client._call('/mempool')
        const mempoolSize = mempoolInfo?.count || undefined

        const feeEstimates = await client.getFeeEstimates()
        const medianFee = feeEstimates['6'] || feeEstimates['3'] || undefined

        setNodeInfo({
          blockHeight,
          medianFee,
          mempoolSize,
          network: network as string,
          responseTime,
          software: 'Esplora'
        })

        return {
          success: true
        }
      }
      throw new Error('Unknown backend')
    }

    function timeoutPromise(): Promise<never> {
      return new Promise((_resolve, reject) => {
        setTimeout(
          () => reject(new Error('Connection test timeout')),
          connectionTimeout
        )
      })
    }

    try {
      const result = await Promise.race([testPromise(), timeoutPromise()])

      if (result && result.success) {
        return result
      }

      const errorMessage = proxy?.enabled
        ? 'Proxy connection failed. Ensure Tor/Orbot is running.'
        : 'Connection test failed'

      return {
        error: errorMessage,
        success: false
      }
    } catch (error) {
      // Failed to get node info
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown connection error'

      // Still set basic info even if enhanced info fails
      const responseTime = Date.now() - startTime
      setNodeInfo({
        network: network as string,
        responseTime,
        software: backend === 'electrum' ? 'Electrum' : 'Esplora'
      })

      return {
        error: errorMessage,
        success: false
      }
    }
  }

  function resetTest() {
    cleanupPreviousConnection()
    setTesting(false)
    setNodeInfo(null)
  }

  // Cleanup on unmount
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
