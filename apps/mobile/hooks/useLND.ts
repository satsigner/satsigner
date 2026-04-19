import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { LND_REST } from '@/constants/lightningLnd'
import { useLightningStore } from '@/store/lightning'
import { type LndBlockchainBalanceResponse } from '@/types/lndNodeDashboard'
import type {
  LndChanBackupSnapshot,
  LndListPeersResponse,
  LndPendingChannelsResponse
} from '@/types/lndNodeSettings'
import type {
  LNDChannel,
  LNDNodeInfo,
  LNDPaymentResponse,
  LNDRequest,
  LNDRequestOptions
} from '@/types/models/LND'
import { parseLndChannelPoint } from '@/utils/lndChannelDetail'

export const useLND = () => {
  const { channels, isConnected, isConnecting, lastSync, nodeInfo } =
    useLightningStore(
      useShallow((state) => ({
        channels: state.status.channels,
        isConnected: state.status.isConnected,
        isConnecting: state.status.isConnecting,
        lastSync: state.status.lastSync,
        nodeInfo: state.status.nodeInfo
      }))
    )

  const config = useLightningStore((state) => state.config)
  const setConnecting = useLightningStore((state) => state.setConnecting)
  const setConnected = useLightningStore((state) => state.setConnected)
  const setNodeInfo = useLightningStore((state) => state.setNodeInfo)
  const setChannels = useLightningStore((state) => state.setChannels)
  const updateLastSync = useLightningStore((state) => state.updateLastSync)

  const getInfo = async (): Promise<LNDNodeInfo> => {
    if (!config) {
      throw new Error('No LND configuration available')
    }

    try {
      const response = await fetch(`${config.url}/v1/getinfo`, {
        headers: {
          'Content-Type': 'application/json',
          'Grpc-Metadata-macaroon': config.macaroon
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
      setConnected(false)
      throw error
    }
  }

  const makeRequest: LNDRequest = async <T>(
    endpoint: string,
    options: LNDRequestOptions = {}
  ) => {
    if (!config) {
      throw new Error('No LND configuration available')
    }

    const {
      body,
      disconnectOnError = true,
      headers = {},
      method = 'GET'
    } = options
    setConnecting(true)

    try {
      const response = await fetch(`${config.url}${endpoint}`, {
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          'Grpc-Metadata-macaroon': config.macaroon,
          ...headers
        },
        method
      })

      if (!response.ok) {
        if (disconnectOnError) {
          setConnected(false)
        }
        const errorText = await response.text()
        const error = new Error(
          `LND API error: ${response.status} ${errorText}`
        )
        throw error
      }

      const data = await response.json()
      return data as T
    } finally {
      setConnecting(false)
    }
  }

  const getBalance = (): Promise<LndBlockchainBalanceResponse> =>
    makeRequest<LndBlockchainBalanceResponse>('/v1/balance/blockchain')

  const getChannels = async (): Promise<LNDChannel[]> => {
    try {
      const response = await makeRequest<{ channels: LNDChannel[] }>(
        LND_REST.CHANNELS
      )
      setChannels(response.channels)
      return response.channels
    } catch (error) {
      setChannels([])
      throw error
    }
  }

  const createInvoice = (amount: number, description: string) =>
    makeRequest('/v1/invoices', {
      body: {
        memo: description,
        value: amount
      },
      method: 'POST'
    })

  const payInvoice = async (paymentRequest: string) => {
    const response = await makeRequest<LNDPaymentResponse>(
      '/v1/channels/transactions',
      {
        body: {
          payment_request: paymentRequest
        },
        method: 'POST'
      }
    )

    const paymentHash = response.payment_hash
    if (paymentHash) {
      let attempts = 0
      const maxAttempts = 30 // Poll for up to 30 seconds
      const pollInterval = 1000 // Check every second

      while (attempts < maxAttempts) {
        attempts += 1
        await new Promise((resolve) => {
          setTimeout(resolve, pollInterval)
        })

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
        }
      }
    }

    return response
  }

  const exportAllChannelBackups = () =>
    makeRequest<LndChanBackupSnapshot>(LND_REST.CHANNEL_BACKUP_ALL, {
      disconnectOnError: false
    })

  const exportChannelBackupSingle = (channelPoint: string) => {
    const parsed = parseLndChannelPoint(channelPoint)
    if (!parsed) {
      return Promise.reject(new Error('Invalid channel point'))
    }
    return makeRequest<Record<string, unknown>>(
      `/v1/channels/backup/${encodeURIComponent(parsed.txid)}/${encodeURIComponent(parsed.vout)}`,
      { disconnectOnError: false }
    )
  }

  const closeChannel = async (
    channelPoint: string,
    opts: { force: boolean }
  ) => {
    if (!config) {
      throw new Error('No LND configuration available')
    }
    const parsed = parseLndChannelPoint(channelPoint)
    if (!parsed) {
      throw new Error('Invalid channel point')
    }
    const qs = new URLSearchParams({
      force: String(opts.force),
      no_wait: 'true'
    })
    const url = `${config.url}/v1/channels/${encodeURIComponent(parsed.txid)}/${encodeURIComponent(parsed.vout)}?${qs}`
    setConnecting(true)
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Grpc-Metadata-macaroon': config.macaroon
        },
        method: 'DELETE'
      })
      const body = await response.text()
      if (!response.ok) {
        throw new Error(`LND API error: ${response.status} ${body}`)
      }
      if (!body) {
        return {}
      }
      try {
        return JSON.parse(body) as Record<string, unknown>
      } catch {
        return {}
      }
    } finally {
      setConnecting(false)
    }
  }

  const getPendingChannels = () =>
    makeRequest<LndPendingChannelsResponse>(LND_REST.CHANNELS_PENDING, {
      disconnectOnError: false
    })

  const getPeers = () =>
    makeRequest<LndListPeersResponse>(LND_REST.PEERS, {
      disconnectOnError: false
    })

  const verifyConnection = async () => {
    if (!config) {
      return false
    }

    try {
      await getInfo()
      return true
    } catch {
      return false
    }
  }

  useEffect(() => {
    if (!config) {
      return
    }

    const checkInterval = setInterval(async () => {
      await verifyConnection()
    }, 30000) // Check every 30 seconds

    return () => clearInterval(checkInterval)
  }, [config]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    channels,
    closeChannel,
    config,
    createInvoice,
    exportAllChannelBackups,
    exportChannelBackupSingle,
    getBalance,
    getChannels,
    getInfo,
    getPeers,
    getPendingChannels,
    isConnected,
    isConnecting,
    lastSync,
    makeRequest,
    nodeInfo,
    payInvoice,
    verifyConnection
  }
}
