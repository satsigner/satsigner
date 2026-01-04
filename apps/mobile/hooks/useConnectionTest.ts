import { useCallback, useEffect, useState } from 'react'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import {
  type Backend,
  type Network,
  type ProxyConfig
} from '@/types/settings/blockchain'

export type NodeInfo = {
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
  const [currentClient, setCurrentClient] = useState<any>(null)
  const [lastTestTime, setLastTestTime] = useState<number>(0)

  const cleanupPreviousConnection = useCallback(() => {
    if (!currentClient) return

    // close TLS connection. Apply only toElectrum Client
    if (currentClient.close && typeof currentClient.close === 'function') {
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
        success: false,
        error: 'Please wait before testing another connection'
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

        const serverInfo = await client.client.initElectrum({
          client: 'satsigner',
          version: '0.0'
        })

        const responseTime = Date.now() - startTime

        // Try to get additional blockchain info with available methods
        let mempoolSize
        const mempoolInfo = await (client.client as any)
          .mempool_get_fee_histogram?.()
          .catch(() => null)
        if (mempoolInfo && Array.isArray(mempoolInfo)) {
          mempoolSize = mempoolInfo.reduce((sum: number, item: any) => {
            return sum + (Array.isArray(item) && item[1] ? item[1] : 0)
          }, 0)
        }

        setNodeInfo({
          version: (serverInfo as any)?.[1] || 'Unknown',
          software: (serverInfo as any)?.[0] || 'Electrum',
          blockHeight: 0, // blockHeight not available in this client
          responseTime,
          network: network as string,
          mempoolSize
        })

        try {
          client.close()
        } catch {}

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
          software: 'Esplora',
          blockHeight,
          responseTime,
          network: network as string,
          mempoolSize,
          medianFee
        })

        return {
          success: true
        }
      }
      throw new Error('Unknown backend')
    }

    async function timeoutPromise() {
      setTimeout(() => {
        throw new Error('Connection test timeout')
      }, connectionTimeout)
    }

    try {
      const result = await Promise.race([testPromise(), timeoutPromise()])

      if (result && result.success) return result

      const errorMessage = proxy?.enabled
        ? 'Proxy connection failed. Ensure Tor/Orbot is running.'
        : 'Connection test failed'

      return {
        success: false,
        error: errorMessage
      }
    } catch (error) {
      // Failed to get node info
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown connection error'

      // Still set basic info even if enhanced info fails
      const responseTime = Date.now() - startTime
      setNodeInfo({
        software: backend === 'electrum' ? 'Electrum' : 'Esplora',
        responseTime,
        network: network as string
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  function resetTest() {
    cleanupPreviousConnection()
    setTesting(false)
    setNodeInfo(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPreviousConnection()
    }
  }, [cleanupPreviousConnection])

  return {
    testing,
    nodeInfo,
    testConnection,
    resetTest
  }
}
