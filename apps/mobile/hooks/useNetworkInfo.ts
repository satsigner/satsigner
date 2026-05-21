import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { useBlockchainStore } from '@/store/blockchain'
import type { Backend, Network } from '@/types/settings/blockchain'

export type BlockHeightSource = 'backend' | 'mempool'

const REFETCH_INTERVAL_MS = 30_000

type NetworkInfoResult = {
  blockHeight: number | null
  blockHeightSource: BlockHeightSource
  fee: number | null
}

async function fetchNetworkInfo(
  network: Network,
  serverUrl: string,
  serverBackend: Backend,
  mempoolUrl: string
): Promise<NetworkInfoResult> {
  let height: number | null = null
  let source: BlockHeightSource = 'mempool'

  if (serverBackend === 'esplora' && serverUrl) {
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
      const tip = await (
        client.client as unknown as {
          blockchainHeaders_subscribe: () => Promise<{
            height: number
          } | null>
        }
      ).blockchainHeaders_subscribe()
      if (tip?.height) {
        height = tip.height as number
        source = 'backend'
      }
    } catch {
      // fall through to mempool
    } finally {
      try {
        client?.close()
      } catch {
        /* silently ignored */
      }
    }
  }

  let fee: number | null = null
  try {
    const oracle = new MempoolOracle(mempoolUrl)
    const [mempoolHeight, fees] = await Promise.all([
      height === null ? oracle.getCurrentBlockHeight() : Promise.resolve(null),
      oracle.getMemPoolFees()
    ])
    if (height === null && mempoolHeight !== null) {
      height = mempoolHeight as number
      source = 'mempool'
    }
    if (fees?.high !== null && fees?.high !== undefined) {
      fee = fees.high
    }
  } catch {
    // backend height kept; fees stay null
  }

  return {
    blockHeight: height,
    blockHeightSource: height !== null ? source : 'mempool',
    fee
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
        mempoolUrl
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
      mempoolUrl
    ],
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true
  })

  return {
    blockHeight: data?.blockHeight ?? null,
    blockHeightSource: data?.blockHeightSource ?? 'mempool',
    nextBlockFee
  }
}
