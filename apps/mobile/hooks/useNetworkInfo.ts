import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient, { closeElectrumClientQuietly } from '@/api/electrum'
import Esplora from '@/api/esplora'
import { fetchBackendNextBlockFee } from '@/api/explorerMempool'
import BitcoinRpc from '@/api/rpc'
import { useBlockchainStore } from '@/store/blockchain'
import type {
  Backend,
  Network,
  RpcCredentials
} from '@/types/settings/blockchain'

export type BlockHeightSource = 'backend' | 'mempool'
export type FeeSource = 'backend' | 'mempool'

const REFETCH_INTERVAL_MS = 30_000

type NetworkInfoResult = {
  blockHeight: number | null
  blockHeightSource: BlockHeightSource
  fee: number | null
  feeSource: FeeSource | null
}

async function fetchNetworkInfo(
  network: Network,
  serverUrl: string,
  serverBackend: Backend,
  mempoolUrl: string,
  rpcCredentials?: RpcCredentials
): Promise<NetworkInfoResult> {
  let height: number | null = null
  let source: BlockHeightSource = 'mempool'

  if (serverBackend === 'rpc' && serverUrl) {
    try {
      const rpc = new BitcoinRpc(
        serverUrl,
        rpcCredentials?.username ?? '',
        rpcCredentials?.password ?? ''
      )
      height = await rpc.getBlockCount()
      source = 'backend'
    } catch {
      // fall through to mempool
    }
  } else if (serverBackend === 'esplora' && serverUrl) {
    try {
      const esplora = new Esplora(serverUrl)
      const rawHeight = await esplora.getLatestBlockHeight()
      height = Number(rawHeight)
      source = 'backend'
    } catch {
      // fall through to mempool
    }
  } else if (serverBackend === 'electrum' && serverUrl) {
    let client: ElectrumClient | null = null
    try {
      client = ElectrumClient.fromUrl(serverUrl, network)
      await client.init()
      const tip = await client.subscribeToBlockHeaders()
      if (tip?.height) {
        height = tip.height
        source = 'backend'
      }
    } catch {
      // fall through to mempool
    } finally {
      closeElectrumClientQuietly(client)
    }
  }

  const backendFee = await fetchBackendNextBlockFee(
    serverUrl,
    serverBackend,
    network,
    rpcCredentials
  )

  let fee = backendFee
  let feeSource: FeeSource | null = backendFee !== null ? 'backend' : null

  try {
    const oracle = new MempoolOracle(mempoolUrl)
    const needsHeight = height === null
    const needsFee = fee === null
    const [mempoolHeight, fees] = await Promise.all([
      needsHeight ? oracle.getCurrentBlockHeight() : Promise.resolve(null),
      needsFee ? oracle.getMemPoolFees() : Promise.resolve(null)
    ])
    if (height === null && typeof mempoolHeight === 'number') {
      height = mempoolHeight
      source = 'mempool'
    }
    if (fee === null && fees?.high !== null && fees?.high !== undefined) {
      fee = fees.high
      feeSource = 'mempool'
    }
  } catch {
    // backend height/fee kept
  }

  return {
    blockHeight: height,
    blockHeightSource: height !== null ? source : 'mempool',
    fee,
    feeSource
  }
}

export function useNetworkInfo() {
  const [selectedNetwork, configsMempool, configs] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configsMempool,
      state.configs
    ])
  )

  const nextBlockFee = useBlockchainStore((state) => state.nextBlockFee)
  const setNextBlockFee = useBlockchainStore((state) => state.setNextBlockFee)

  const { server } = configs[selectedNetwork]
  const mempoolUrl = configsMempool[selectedNetwork]

  const { data } = useQuery({
    gcTime: 0,
    queryFn: async () => {
      const result = await fetchNetworkInfo(
        selectedNetwork,
        server.url,
        server.backend,
        mempoolUrl,
        server.rpcCredentials
      )
      if (
        result.fee !== null &&
        useBlockchainStore.getState().selectedNetwork === selectedNetwork
      ) {
        setNextBlockFee(Math.round(result.fee))
      }
      return result
    },
    queryKey: [
      'networkInfo',
      selectedNetwork,
      server.url,
      server.backend,
      mempoolUrl,
      server.rpcCredentials?.username,
      server.rpcCredentials?.password
    ],
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true
  })

  return {
    blockHeight: data?.blockHeight ?? null,
    blockHeightSource: data?.blockHeightSource ?? 'mempool',
    feeSource: data?.feeSource ?? null,
    nextBlockFee
  }
}
