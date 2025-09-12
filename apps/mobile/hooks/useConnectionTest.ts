import { useState } from 'react'

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

  async function testConnection(
    url: string,
    backend: Backend,
    network: Network
  ): Promise<boolean> {
    setTesting(true)
    setNodeInfo(null)

    const startTime = Date.now()
    try {
      if (backend === 'electrum') {
        // Test Electrum connection and get server info
        const ElectrumClient = (await import('@/api/electrum')).default
        const client = ElectrumClient.fromUrl(url, network)

        // Add error handler to prevent crashes
        if (client.client && typeof client.client.onError === 'function') {
          client.client.onError = (_error: Error) => {
            // Silently handle errors to prevent console noise
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
        return true
      } else if (backend === 'esplora') {
        // Test Esplora connection and get server info
        const Esplora = (await import('@/api/esplora')).default
        const client = new Esplora(url)

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

        return true
      }
    } catch (_error) {
      // Failed to get node info
      // Still set basic info even if enhanced info fails
      const responseTime = Date.now() - startTime
      setNodeInfo({
        software: backend === 'electrum' ? 'Electrum' : 'Esplora',
        responseTime,
        network: network as string
      })
      return false
    }

    return false
  }

  function resetTest() {
    setTesting(false)
    setNodeInfo(null)
  }

  return {
    testing,
    nodeInfo,
    testConnection,
    resetTest
  }
}
