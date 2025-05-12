import { useCallback } from 'react'
import {
  useLightningStore,
  type LNDNodeInfo,
  type LNDChannel
} from '@/stores/lightning'

interface LNDRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

export const useLND = () => {
  const {
    config,
    status,
    setConnecting,
    setConnected,
    setError,
    setNodeInfo,
    setChannels,
    updateLastSync
  } = useLightningStore()

  const makeRequest = useCallback(
    async <T>(
      endpoint: string,
      options: LNDRequestOptions = {}
    ): Promise<T> => {
      if (!config) {
        throw new Error('No LND configuration available')
      }

      const { method = 'GET', body, headers = {} } = options

      try {
        setConnecting(true)
        setError(undefined)

        const response = await fetch(`${config.url}${endpoint}`, {
          method,
          headers: {
            'Grpc-Metadata-macaroon': config.macaroon,
            'Content-Type': 'application/json',
            ...headers
          },
          ...(body && { body: JSON.stringify(body) })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`LND API error: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        return data as T
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        setError(errorMessage)
        setConnected(false)
        throw error
      } finally {
        setConnecting(false)
      }
    },
    [config, setConnecting, setError, setConnected]
  )

  const getInfo = useCallback(async (): Promise<LNDNodeInfo> => {
    try {
      const info = await makeRequest<LNDNodeInfo>('/v1/getinfo')
      setNodeInfo(info)
      setConnected(true)
      updateLastSync()
      return info
    } catch (error) {
      setConnected(false)
      throw error
    }
  }, [makeRequest, setNodeInfo, setConnected, updateLastSync])

  const getBalance = useCallback(async () => {
    return makeRequest('/v1/balance/blockchain')
  }, [makeRequest])

  const getChannels = useCallback(async (): Promise<LNDChannel[]> => {
    try {
      const response = await makeRequest<{ channels: LNDChannel[] }>(
        '/v1/channels'
      )
      setChannels(response.channels)
      return response.channels
    } catch (error) {
      setChannels([])
      throw error
    }
  }, [makeRequest, setChannels])

  const createInvoice = useCallback(
    async (amount: number, description: string) => {
      return makeRequest('/v1/invoices', {
        method: 'POST',
        body: {
          value: amount,
          memo: description
        }
      })
    },
    [makeRequest]
  )

  const payInvoice = useCallback(
    async (paymentRequest: string) => {
      return makeRequest('/v1/channels/transactions', {
        method: 'POST',
        body: {
          payment_request: paymentRequest
        }
      })
    },
    [makeRequest]
  )

  return {
    isConnected: status.isConnected,
    isConnecting: status.isConnecting,
    lastError: status.lastError,
    nodeInfo: status.nodeInfo,
    channels: status.channels,
    lastSync: status.lastSync,
    getInfo,
    getBalance,
    getChannels,
    createInvoice,
    payInvoice,
    makeRequest
  }
}
