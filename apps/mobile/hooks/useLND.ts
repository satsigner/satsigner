import { useCallback, useEffect } from 'react'
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

interface LNDPaymentResponse {
  payment_hash: string
  payment_preimage: string
  status: string
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
        console.log('❌ No LND configuration available')
        throw new Error('No LND configuration available')
      }

      const { method = 'GET', body, headers = {} } = options

      try {
        setConnecting(true)
        setError(undefined)

        console.log('📡 Making LND request:', {
          endpoint,
          method,
          timestamp: new Date().toISOString()
        })

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

          // Only set disconnected for certain error types
          if (response.status === 401 || response.status === 403) {
            console.log('🔒 Authentication error, disconnecting:', {
              status: response.status,
              timestamp: new Date().toISOString()
            })
            setConnected(false)
          } else if (response.status >= 500) {
            console.log('🔌 Server error, might be disconnected:', {
              status: response.status,
              timestamp: new Date().toISOString()
            })
            // Don't immediately disconnect on server errors
            // Instead, try to verify connection
            try {
              await getInfo()
            } catch (verifyError) {
              console.log('❌ Connection verification failed:', {
                error: verifyError,
                timestamp: new Date().toISOString()
              })
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
        console.error('❌ LND request failed:', {
          endpoint,
          error: errorMessage,
          timestamp: new Date().toISOString()
        })
        setError(errorMessage)
        throw error
      } finally {
        setConnecting(false)
      }
    },
    [config, setConnecting, setError, setConnected, getInfo]
  )

  const getInfo = useCallback(async (): Promise<LNDNodeInfo> => {
    try {
      console.log('🔍 Fetching node info...')
      const info = await makeRequest<LNDNodeInfo>('/v1/getinfo')
      console.log('✅ Node info fetched successfully:', {
        alias: info.alias,
        pubkey: info.identity_pubkey,
        synced: info.synced_to_chain,
        timestamp: new Date().toISOString()
      })
      setNodeInfo(info)
      setConnected(true)
      updateLastSync()
      return info
    } catch (error) {
      console.error('❌ Failed to fetch node info:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      })
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
      console.log('💫 Starting LND payment process:', {
        timestamp: new Date().toISOString(),
        requestLength: paymentRequest.length
      })

      try {
        console.log('📤 Sending payment request to LND...')
        const startTime = Date.now()
        const response = await makeRequest<LNDPaymentResponse>(
          '/v1/channels/transactions',
          {
            method: 'POST',
            body: {
              payment_request: paymentRequest
            }
          }
        )
        console.log('📥 Received payment response from LND:', {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          hasPaymentHash: !!response.payment_hash,
          hasPaymentPreimage: !!response.payment_preimage,
          status: response.status
        })

        // Start polling for payment status
        const paymentHash = response.payment_hash
        if (paymentHash) {
          console.log('🔍 Starting payment status polling:', {
            paymentHash,
            timestamp: new Date().toISOString()
          })

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
              console.log('📊 Payment status check:', {
                attempt: attempts,
                status: statusResponse.status,
                timestamp: new Date().toISOString()
              })

              if (statusResponse.status === 'SUCCEEDED') {
                console.log('✅ Payment confirmed:', {
                  totalDuration: Date.now() - startTime,
                  attempts,
                  timestamp: new Date().toISOString()
                })
                return response
              } else if (statusResponse.status === 'FAILED') {
                throw new Error('Payment failed')
              }
            } catch (error) {
              // If we get a 404, it likely means the payment completed and is no longer in pending state
              if (error instanceof Error && error.message.includes('404')) {
                console.log('✅ Payment completed (404 on status check):', {
                  totalDuration: Date.now() - startTime,
                  attempts,
                  timestamp: new Date().toISOString()
                })
                return response
              }
              console.error('❌ Payment status check failed:', {
                attempt: attempts,
                error,
                timestamp: new Date().toISOString()
              })
              // Don't throw here, keep polling
            }
          }

          console.log('⚠️ Payment status polling timed out:', {
            totalDuration: Date.now() - startTime,
            attempts,
            timestamp: new Date().toISOString()
          })
        }

        return response
      } catch (error) {
        console.error('❌ LND payment failed:', {
          error,
          timestamp: new Date().toISOString()
        })
        throw error
      }
    },
    [makeRequest]
  )

  // Add a connection verification function
  const verifyConnection = useCallback(async () => {
    if (!config) return false

    try {
      console.log('🔍 Verifying LND connection...')
      await getInfo()
      console.log('✅ Connection verified')
      return true
    } catch (error) {
      console.error('❌ Connection verification failed:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      })
      return false
    }
  }, [config, getInfo])

  // Add periodic connection check
  useEffect(() => {
    if (!config) return

    const checkInterval = setInterval(async () => {
      const isStillConnected = await verifyConnection()
      console.log('🔄 Periodic connection check:', {
        isConnected: isStillConnected,
        timestamp: new Date().toISOString()
      })
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
