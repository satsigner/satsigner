import { useCallback, useEffect, useState } from 'react'

import { type Backend, type Network } from '@/types/settings/blockchain'

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

export function useConnectionTest() {
  const [testing, setTesting] = useState(false)
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null)
  const [currentClient, setCurrentClient] = useState<any>(null)
  const [lastTestTime, setLastTestTime] = useState<number>(0)

  const cleanupPreviousConnection = useCallback(async () => {
    if (currentClient) {
      try {
        // Force close any ongoing connections with timeout
        if (
          currentClient.client &&
          currentClient.client.close &&
          typeof currentClient.client.close === 'function'
        ) {
          await Promise.race([
            currentClient.client.close(),
            new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second timeout
          ])
        }
        if (currentClient.close && typeof currentClient.close === 'function') {
          await Promise.race([
            currentClient.close(),
            new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second timeout
          ])
        }

        // Restore original reconnect function if it was stored
        if (currentClient.client && (currentClient as any).originalReconnect) {
          currentClient.client.reconnect = (
            currentClient as any
          ).originalReconnect
        }
      } catch (_error) {
        // Silently handle cleanup errors
      } finally {
        setCurrentClient(null)
      }
    }
  }, [currentClient])

  async function testConnection(
    url: string,
    backend: Backend,
    network: Network
  ): Promise<{ success: boolean; error?: string }> {
    // Debounce rapid connection attempts to prevent memory issues
    const now = Date.now()
    if (now - lastTestTime < 2000) {
      // 2 second debounce
      return {
        success: false,
        error: 'Please wait before testing another connection'
      }
    }
    setLastTestTime(now)

    // Suppress console warnings during connection tests
    // eslint-disable-next-line no-console
    const originalConsoleWarn = console.warn
    // eslint-disable-next-line no-console
    const originalConsoleError = console.error
    // eslint-disable-next-line no-console
    console.warn = () => {} // Suppress warnings
    // eslint-disable-next-line no-console
    console.error = () => {} // Suppress errors

    // Clean up any previous connection first
    await cleanupPreviousConnection()

    setTesting(true)
    setNodeInfo(null)

    const startTime = Date.now()
    const connectionTimeout = 10000 // 10 second timeout to prevent memory issues

    try {
      // Wrap the entire connection test in a timeout to prevent memory issues
      const testPromise = (async () => {
        if (backend === 'electrum') {
          // Test Electrum connection and get server info
          const ElectrumClient = (await import('@/api/electrum')).default
          const client = ElectrumClient.fromUrl(url, network)

          // Store current client for cleanup
          setCurrentClient(client)

          // Add error handler to prevent crashes and console warnings
          if (client.client && typeof client.client.onError === 'function') {
            client.client.onError = () => {
              // Silently handle errors to prevent console noise
            }
          }

          // Store original reconnect function to restore later
          const originalReconnect = client.client?.reconnect
          if (client.client && client.client.reconnect) {
            // Store the original function for later restoration
            ;(client as any).originalReconnect = originalReconnect
            client.client.reconnect = () => {
              // Disable reconnection during tests to prevent console warnings
            }
          }

          const serverInfo = await client.client.initElectrum({
            client: 'satsigner',
            version: '1.4'
          })

          const blockHeight = await client.client.blockchainHeaders_subscribe()
          const responseTime = Date.now() - startTime

          // Try to get additional blockchain info with available methods
          let mempoolSize
          try {
            // Try to get mempool info using available methods
            const mempoolInfo = await client.client
              .mempool_get_fee_histogram?.()
              .catch(() => null)
            if (mempoolInfo && Array.isArray(mempoolInfo)) {
              mempoolSize = mempoolInfo.reduce((sum: number, item: any) => {
                return sum + (Array.isArray(item) && item[1] ? item[1] : 0)
              }, 0)
            }
          } catch (_e) {
            // Mempool info not available
          }

          setNodeInfo({
            version: serverInfo[1] || 'Unknown',
            software: serverInfo[0] || 'Electrum',
            blockHeight: blockHeight?.height || 0,
            responseTime,
            network: network as string,
            mempoolSize
          })

          try {
            client.close()
          } catch (_closeError) {
            // Silently handle close errors
          }
          return { success: true }
        } else if (backend === 'esplora') {
          // Test Esplora connection and get server info
          const Esplora = (await import('@/api/esplora')).default
          const client = new Esplora(url)

          // Store current client for cleanup
          setCurrentClient(client)

          // Get basic info first
          const blockHeight = await client.getLatestBlockHeight()
          const responseTime = Date.now() - startTime

          // Try to get additional info with proper error handling
          let mempoolSize, medianFee
          try {
            const mempoolInfo = await client._call('/mempool')
            mempoolSize = mempoolInfo?.count || undefined
          } catch (_e) {
            // Esplora mempool info not available
          }

          try {
            const feeEstimates = await client.getFeeEstimates()
            medianFee = feeEstimates['6'] || feeEstimates['3'] || undefined
          } catch (_e) {
            // Esplora fee estimates not available
          }

          setNodeInfo({
            software: 'Esplora',
            blockHeight,
            responseTime,
            network: network as string,
            mempoolSize,
            medianFee
          })

          return { success: true }
        }
      })() // Close the async function

      // Add timeout wrapper
      const timeoutPromise = new Promise<{ success: boolean; error?: string }>(
        (_, reject) => {
          setTimeout(
            () => reject(new Error('Connection test timeout')),
            connectionTimeout
          )
        }
      )

      const result = await Promise.race([testPromise, timeoutPromise])
      return result || { success: false, error: 'Connection test failed' }
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
      return { success: false, error: errorMessage }
    } finally {
      // Restore console functions
      // eslint-disable-next-line no-console
      console.warn = originalConsoleWarn
      // eslint-disable-next-line no-console
      console.error = originalConsoleError
    }

    // This line is unreachable due to the finally block above
    // but kept for type safety
    // eslint-disable-next-line no-unreachable
    return { success: false, error: 'Connection test failed' }
  }

  async function resetTest() {
    await cleanupPreviousConnection()
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
