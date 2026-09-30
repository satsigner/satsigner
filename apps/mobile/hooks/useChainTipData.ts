import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient, { closeElectrumClientQuietly } from '@/api/electrum'
import Esplora from '@/api/esplora'
import {
  fetchMempoolBasicData,
  type MempoolBasicData
} from '@/api/explorerMempool'
import { getLocalPriceSeries, isUsablePrice } from '@/api/localPrices'
import BitcoinRpc from '@/api/rpc'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import type { Block, MemPoolFees } from '@/types/models/Blockchain'
import { CurrencySchema } from '@/types/models/Blockchain'
import type {
  Backend,
  Network,
  RpcCredentials
} from '@/types/settings/blockchain'
import { getDifficultyFromBits } from '@/utils/bitcoin/difficulty'
import { PRICE_CHART_DAYS } from '@/utils/priceChart'
import { time } from '@/utils/time'

export { PRICE_CHART_DAYS }

export type DataSource = 'backend' | 'mempool'

export type ChainTipData = {
  height: number | null
  hash: string | null
  block: Partial<Block> | null
  fees: MemPoolFees | null
  mempool: { count?: number; vsize?: number; total_fee?: number } | null
  blockSource: DataSource
  feesSource: DataSource
  mempoolSource: DataSource
}

function emptyChainTipData(): ChainTipData {
  return {
    block: null,
    blockSource: 'backend',
    fees: null,
    feesSource: 'backend',
    hash: null,
    height: null,
    mempool: null,
    mempoolSource: 'backend'
  }
}

async function blockFromEsplora(
  esplora: Esplora
): Promise<Partial<ChainTipData>> {
  const [rawHeight, rawHash] = await Promise.all([
    esplora.getLatestBlockHeight(),
    esplora.getLatestBlockHash()
  ])
  const hash = String(rawHash)
  return {
    block: await esplora.getBlockInfo(hash),
    hash,
    height: Number(rawHeight)
  }
}

async function blockFromElectrum(
  url: string,
  network: Network
): Promise<Partial<ChainTipData>> {
  const client = ElectrumClient.fromUrl(url, network)
  try {
    await client.init()
    const tip = await client.subscribeToBlockHeaders()
    if (!tip?.height) {
      return {}
    }
    const header = await client.getBlock(tip.height)
    return {
      block: {
        difficulty: header.bits
          ? getDifficultyFromBits(header.bits)
          : undefined,
        height: tip.height,
        timestamp: header.timestamp
      },
      hash: header.getId(),
      height: tip.height
    }
  } finally {
    closeElectrumClientQuietly(client)
  }
}

async function blockFromRpc(
  url: string,
  rpcCredentials?: RpcCredentials
): Promise<Partial<ChainTipData>> {
  const rpc = new BitcoinRpc(
    url,
    rpcCredentials?.username ?? '',
    rpcCredentials?.password ?? ''
  )
  const info = await rpc.getBlockchainInfo()
  const rpcBlock = await rpc.getBlock(info.bestblockhash)
  return {
    block: {
      difficulty: rpcBlock.difficulty,
      height: rpcBlock.height,
      size: rpcBlock.size,
      timestamp: rpcBlock.time,
      tx_count: rpcBlock.tx.length,
      weight: rpcBlock.weight
    },
    hash: info.bestblockhash,
    height: info.blocks
  }
}

function fetchTipBlock(
  serverUrl: string,
  backend: Backend,
  network: Network,
  rpcCredentials?: RpcCredentials
): Promise<Partial<ChainTipData>> {
  if (!serverUrl) {
    return Promise.resolve({})
  }
  if (backend === 'esplora') {
    return blockFromEsplora(new Esplora(serverUrl))
  }
  if (backend === 'electrum') {
    return blockFromElectrum(serverUrl, network)
  }
  if (backend === 'rpc') {
    return blockFromRpc(serverUrl, rpcCredentials)
  }
  return Promise.resolve({})
}

function toChainTipMempool(basic: MempoolBasicData): ChainTipData['mempool'] {
  if (basic.count === null && basic.vsize === null && basic.totalFee === null) {
    return null
  }
  return {
    count: basic.count ?? undefined,
    total_fee: basic.totalFee ?? undefined,
    vsize: basic.vsize ?? undefined
  }
}

/** Tip block from the backend; fees and mempool via the explorer mempool API. */
async function fetchChainTipData(
  serverUrl: string,
  backend: Backend,
  network: Network,
  rpcCredentials?: RpcCredentials
): Promise<ChainTipData> {
  const [block, basic] = await Promise.all([
    fetchTipBlock(serverUrl, backend, network, rpcCredentials).catch(
      () => ({})
    ),
    fetchMempoolBasicData(serverUrl, backend, network, rpcCredentials)
  ])
  return {
    ...emptyChainTipData(),
    ...block,
    fees: basic.fees,
    // No backend fees: chaintip falls back to mempool.space fees.
    feesSource: basic.fees ? 'backend' : 'mempool',
    mempool: toChainTipMempool(basic)
  }
}

export function useChainTipData() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]

  return useQuery({
    queryFn: () =>
      fetchChainTipData(
        server.url,
        server.backend,
        selectedNetwork,
        server.rpcCredentials
      ),
    queryKey: [
      'chain-tip',
      server.url,
      server.backend,
      selectedNetwork,
      server.rpcCredentials?.username
    ],
    staleTime: time.minutes(1)
  })
}

export function useChainTipMempoolStats(
  timeRange: '2h' | '24h' | '1w',
  enabled: boolean
) {
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const oracle = useMempoolOracle(selectedNetwork)

  return useQuery({
    enabled,
    queryFn: () => oracle.getMempoolStatistics(timeRange),
    queryKey: ['chaintip-statistics', timeRange, selectedNetwork],
    staleTime: time.minutes(5)
  })
}

const SECONDS_PER_DAY = 86_400

function windowPriceHistory(series: { price: number; time: number }[]) {
  const cutoff =
    Math.floor(Date.now() / 1000) - PRICE_CHART_DAYS * SECONDS_PER_DAY
  const window = series.filter(
    (point) => point.time >= cutoff && isUsablePrice(point.price)
  )
  return {
    prices: window.map((point) => point.price),
    timestamps: window.map((point) => point.time)
  }
}

export function useChainTipPriceHistory(
  fiatCurrency: string,
  enabled: boolean
) {
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const oracle = useMempoolOracle(selectedNetwork)

  return useQuery({
    enabled,
    queryFn: async () => {
      try {
        const series = await oracle.getHistoricalPriceSeries(fiatCurrency)
        return windowPriceHistory(series)
      } catch {
        const parsed = CurrencySchema.safeParse(fiatCurrency)
        if (!parsed.success) {
          throw new Error(`Unknown fiat currency ${fiatCurrency}`)
        }
        return windowPriceHistory(
          getLocalPriceSeries(parsed.data).filter((point) =>
            isUsablePrice(point.price)
          )
        )
      }
    },
    queryKey: [
      'chaintip-price-history',
      PRICE_CHART_DAYS,
      fiatCurrency,
      selectedNetwork
    ],
    staleTime: time.minutes(10)
  })
}
