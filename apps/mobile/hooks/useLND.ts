/* eslint-disable no-console */
import { useCallback, useEffect } from 'react'

import {
  type LNDChannel,
  type LNDNodeInfo,
  useLightningStore
} from '@/store/lightning'

interface LNDRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

interface LNDPaymentResponse {
  payment_hash: string
  payment_preimage: string
  status: string
}

type MakeRequestFn = <T>(
  endpoint: string,
  options?: LNDRequestOptions
) => Promise<T>

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

  const getInfo = useCallback(async (): Promise<LNDNodeInfo> => {
    if (!config) {
      throw new Error('No LND configuration available')
    }

    try {
      const response = await fetch(`${config.url}/v1/getinfo`, {
        headers: {
          'Grpc-Metadata-macaroon': config.macaroon,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch node info: ${response.status}`)
      }

      const info = (await response.json()) as LNDNodeInfo
      setNodeInfo(info)
      setConnected(true)
      updateLastSync()
      return info
    } catch (error) {
      console.error('Failed to fetch node info:', {
        error: error instanceof Error ? error.message : String(error)
      })
      setConnected(false)
      throw error
    }
  }, [config, setNodeInfo, setConnected, updateLastSync])

  const makeRequest: MakeRequestFn = useCallback(
    async <T>(endpoint: string, options: LNDRequestOptions = {}) => {
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
          body: body ? JSON.stringify(body) : undefined
        })

        if (!response.ok) {
          const errorText = await response.text()
          const error = new Error(
            `LND API error: ${response.status} ${errorText}`
          )

          if (response.status === 401 || response.status === 403) {
            setConnected(false)
          } else if (response.status >= 500) {
            try {
              await getInfo()
            } catch {
              setConnected(false)
            }
          }

          throw error
        }

        const data = await response.json()
        return data as T
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        console.error('LND request failed:', {
          endpoint,
          error: errorMessage
        })
        setError(errorMessage)
        throw error
      } finally {
        setConnecting(false)
      }
    },
    [config, setConnecting, setError, setConnected, getInfo]
  )

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
      try {
        const response = await makeRequest<LNDPaymentResponse>(
          '/v1/channels/transactions',
          {
            method: 'POST',
            body: {
              payment_request: paymentRequest
            }
          }
        )

        const paymentHash = response.payment_hash
        if (paymentHash) {
          let attempts = 0
          const maxAttempts = 30 // Poll for up to 30 seconds
          const pollInterval = 1000 // Check every second

          while (attempts < maxAttempts) {
            attempts++
            await new Promise((resolve) => setTimeout(resolve, pollInterval))

            try {
              const statusResponse = await makeRequest<{ status: string }>(
                `/v1/payments/${paymentHash}`
              )

              if (statusResponse.status === 'SUCCEEDED') {
                return response
              } else if (statusResponse.status === 'FAILED') {
                throw new Error('Payment failed')
              }
            } catch (error) {
              if (error instanceof Error && error.message.includes('404')) {
                return response
              }
              console.error('Payment status check failed:', {
                attempt: attempts,
                error
              })
            }
          }
        }

        return response
      } catch (error) {
        console.error('LND payment failed:', {
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    },
    [makeRequest]
  )

  const verifyConnection = useCallback(async () => {
    if (!config) return false

    try {
      await getInfo()
      return true
    } catch (error) {
      console.error('Connection verification failed:', {
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }, [config, getInfo])

  useEffect(() => {
    if (!config) return

    const checkInterval = setInterval(async () => {
      await verifyConnection()
    }, 30000) // Check every 30 seconds

    return () => clearInterval(checkInterval)
  }, [config, verifyConnection])

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
    makeRequest,
    verifyConnection
  }
}
