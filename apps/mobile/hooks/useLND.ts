import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import {
  closeLndChannel,
  fetchLndNodeInfo,
  requestLndRestJson
} from '@/api/lndRestRequest'
import { LND_REST } from '@/constants/lightning'
import { useLightningStore } from '@/store/lightning'
import type {
  LNDChanBackupSnapshot,
  LNDConnectPeerRequest,
  LNDListPeersResponse,
  LNDNewAddressResponse,
  LNDOpenChannelRequest,
  LNDOpenChannelResponse,
  LNDPendingChannelsResponse,
  LNDSendCoinsRequest,
  LNDSendCoinsResponse,
  LNDBlockchainBalanceResponse,
  LNDChannel,
  LNDInvoice,
  LNDNodeInfo,
  LNDPaymentResponse,
  LNDRequest,
  LNDRequestOptions
} from '@/types/models/Lightning'
import { parseLndChannelPoint } from '@/utils/lndChannelDetail'
import { buildNewAddressPath } from '@/utils/lndOnchainWallet'
import {
  assertLndPaymentSucceeded,
  buildLndPayInvoiceBody
} from '@/utils/lndPayInvoice'

const HEALTH_CHECK_INTERVAL_MS = 30_000

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
      const info = await fetchLndNodeInfo(config)
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

    return await requestLndRestJson<T>(
      config,
      endpoint,
      { body, headers, method },
      () => {
        if (disconnectOnError) {
          setConnected(false)
        }
      }
    ).finally(() => setConnecting(false))
  }

  const getBalance = (): Promise<LNDBlockchainBalanceResponse> =>
    makeRequest<LNDBlockchainBalanceResponse>('/v1/balance/blockchain')

  const getNewAddress = (fresh = false) =>
    makeRequest<LNDNewAddressResponse>(buildNewAddressPath(fresh), {
      disconnectOnError: false
    })

  const sendCoins = (body: LNDSendCoinsRequest) =>
    makeRequest<LNDSendCoinsResponse>(LND_REST.SEND_COINS, {
      body,
      disconnectOnError: false,
      method: 'POST'
    })

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
    makeRequest<LNDInvoice>('/v1/invoices', {
      body: {
        memo: description,
        value: amount
      },
      method: 'POST'
    })

  const payInvoice = async (paymentRequest: string, amountSat?: number) => {
    const response = await makeRequest<LNDPaymentResponse>(
      '/v1/channels/transactions',
      {
        body: buildLndPayInvoiceBody(paymentRequest, amountSat),
        method: 'POST'
      }
    )
    assertLndPaymentSucceeded(response)
    return response
  }

  const exportAllChannelBackups = () =>
    makeRequest<LNDChanBackupSnapshot>(LND_REST.CHANNEL_BACKUP_ALL, {
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
    setConnecting(true)
    return await closeLndChannel(config, parsed, opts.force).finally(() =>
      setConnecting(false)
    )
  }

  const getPendingChannels = () =>
    makeRequest<LNDPendingChannelsResponse>(LND_REST.CHANNELS_PENDING, {
      disconnectOnError: false
    })

  const getPeers = () =>
    makeRequest<LNDListPeersResponse>(LND_REST.PEERS, {
      disconnectOnError: false
    })

  const connectPeer = (input: { host: string; pubkey: string }) => {
    const body: LNDConnectPeerRequest = {
      addr: {
        host: input.host,
        pubkey: input.pubkey
      }
    }
    return makeRequest<Record<string, unknown>>(LND_REST.PEERS, {
      body,
      disconnectOnError: false,
      method: 'POST'
    })
  }

  const openChannel = (body: LNDOpenChannelRequest) =>
    makeRequest<LNDOpenChannelResponse>(LND_REST.CHANNELS_OPEN, {
      body,
      disconnectOnError: false,
      method: 'POST'
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

  useQuery({
    enabled: Boolean(config),
    initialData: false,
    initialDataUpdatedAt: () => Date.now(),
    queryFn: verifyConnection,
    queryKey: ['lnd', 'health', config?.url],
    refetchInterval: HEALTH_CHECK_INTERVAL_MS,
    refetchIntervalInBackground: true,
    staleTime: HEALTH_CHECK_INTERVAL_MS
  })

  return {
    channels,
    closeChannel,
    config,
    connectPeer,
    createInvoice,
    exportAllChannelBackups,
    exportChannelBackupSingle,
    getBalance,
    getChannels,
    getInfo,
    getNewAddress,
    getPeers,
    getPendingChannels,
    isConnected,
    isConnecting,
    lastSync,
    makeRequest,
    nodeInfo,
    openChannel,
    payInvoice,
    sendCoins,
    verifyConnection
  }
}
