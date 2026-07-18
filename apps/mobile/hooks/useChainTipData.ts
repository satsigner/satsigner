import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import type { Block, MemPoolFees } from '@/types/models/Blockchain'
import type {
  Backend,
  Network,
  RpcCredentials
} from '@/types/settings/blockchain'
import { getDifficultyFromBits } from '@/utils/bitcoin/difficulty'
import { feesFromBtcPerKb } from '@/utils/rpcFees'
import { time } from '@/utils/time'

function feesFromEsploraEstimates(
  estimates: Record<string, number>
): MemPoolFees | null {
  function rate(key: string): number | null {
    const value = estimates[key]
    return typeof value === 'number' ? value : null
  }
  const high = rate('1') ?? rate('2')
  if (high === null) {
    return null
  }
  return {
    high,
    low: rate('6') ?? rate('12') ?? high,
    medium: rate('3') ?? rate('6') ?? high,
    none: rate('144') ?? rate('504') ?? 1
  }
}

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

function safeClose(client: ElectrumClient | null): void {
  try {
    client?.close()
  } catch {
    /* silently ignored */
  }
}

async function fromEsplora(esplora: Esplora): Promise<ChainTipData> {
  const data = emptyChainTipData()
  await Promise.all([
    (async () => {
      try {
        const [rawHeight, rawHash] = await Promise.all([
          esplora.getLatestBlockHeight(),
          esplora.getLatestBlockHash()
        ])
        data.height = Number(rawHeight)
        data.hash = String(rawHash)
        data.block = await esplora.getBlockInfo(data.hash)
        data.blockSource = 'backend'
      } catch {
        /* silently ignored */
      }
    })(),
    (async () => {
      try {
        const info = await esplora.getMempoolInfo()
        if (info) {
          data.mempool = {
            count: info.count,
            total_fee: info.total_fee,
            vsize: info.vsize
          }
          data.mempoolSource = 'backend'
        }
      } catch {
        /* silently ignored */
      }
    })(),
    (async () => {
      try {
        const estimates = await esplora.getFeeEstimates()
        const fees = feesFromEsploraEstimates(estimates)
        if (fees) {
          data.fees = fees
          data.feesSource = 'backend'
        }
      } catch {
        /* silently ignored */
      }
    })()
  ])
  return data
}

async function fromElectrum(
  url: string,
  network: Network
): Promise<ChainTipData> {
  const data = emptyChainTipData()
  let client: ElectrumClient | null = null
  try {
    client = ElectrumClient.fromUrl(url, network)
    await client.init()
    await Promise.all([
      (async () => {
        try {
          const tip = await client!.subscribeToBlockHeaders()
          if (!tip?.height) {
            return
          }
          data.height = tip.height
          const header = await client!.getBlock(tip.height)
          data.hash = header.getId()
          data.block = {
            difficulty: header.bits
              ? getDifficultyFromBits(header.bits)
              : undefined,
            height: tip.height,
            timestamp: header.timestamp
          }
          data.blockSource = 'backend'
        } catch {
          /* silently ignored */
        }
      })(),
      (async () => {
        try {
          const histogram = await client!.getMempoolFeeHistogram()
          if (histogram.length > 0) {
            const vsize = histogram.reduce((sum, [, size]) => sum + size, 0)
            data.mempool = { vsize }
            data.mempoolSource = 'backend'
          }
        } catch {
          /* silently ignored */
        }
      })()
    ])
  } catch {
    /* connection init failed */
  } finally {
    safeClose(client)
  }
  return data
}

async function fromRpc(
  url: string,
  username: string,
  password: string
): Promise<ChainTipData> {
  const data = emptyChainTipData()
  const rpc = new BitcoinRpc(url, username, password)

  await Promise.all([
    (async () => {
      try {
        const info = await rpc.getBlockchainInfo()
        data.height = info.blocks
        data.hash = info.bestblockhash
        data.blockSource = 'backend'
        const rpcBlock = await rpc.getBlock(info.bestblockhash)
        data.block = {
          difficulty: rpcBlock.difficulty,
          height: rpcBlock.height,
          size: rpcBlock.size,
          timestamp: rpcBlock.time,
          tx_count: rpcBlock.tx.length,
          weight: rpcBlock.weight
        }
      } catch {
        /* silently ignored */
      }
    })(),
    (async () => {
      try {
        const mempoolInfo = await rpc.getMempoolInfo()
        data.mempool = {
          count: mempoolInfo.size,
          vsize: mempoolInfo.bytes
        }
        data.mempoolSource = 'backend'
      } catch {
        /* silently ignored */
      }
    })(),
    (async () => {
      try {
        const feeResult = await rpc.estimateSmartFee(1)
        if (feeResult.feerate !== undefined) {
          data.fees = feesFromBtcPerKb(feeResult.feerate)
          data.feesSource = 'backend'
        }
      } catch {
        /* silently ignored */
      }
    })()
  ])

  return data
}

function fetchChainTipData(
  serverUrl: string,
  backend: Backend,
  network: Network,
  rpcCredentials?: RpcCredentials
): Promise<ChainTipData> {
  if (backend === 'esplora' && serverUrl) {
    return fromEsplora(new Esplora(serverUrl))
  }
  if (backend === 'electrum' && serverUrl) {
    return fromElectrum(serverUrl, network)
  }
  if (backend === 'rpc' && serverUrl) {
    return fromRpc(
      serverUrl,
      rpcCredentials?.username ?? '',
      rpcCredentials?.password ?? ''
    )
  }
  return Promise.resolve(emptyChainTipData())
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

export function useChainTipPriceHistory(
  fiatCurrency: string,
  enabled: boolean
) {
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const oracle = useMempoolOracle(selectedNetwork)
  const PRICE_CHART_DAYS = 7

  return useQuery({
    enabled,
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000)
      const timestamps = Array.from(
        { length: PRICE_CHART_DAYS },
        (_, i) => now - (PRICE_CHART_DAYS - 1 - i) * 86400
      )
      const prices = await oracle.getPricesAt(fiatCurrency, timestamps)
      return { prices, timestamps }
    },
    queryKey: ['chaintip-price-history', fiatCurrency, selectedNetwork],
    staleTime: time.minutes(10)
  })
}

export type ChainTipExternalData = {
  fees: MemPoolFees | null
  mempool: ChainTipData['mempool']
}

export function useChainTipExternalData(enabled: boolean) {
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const oracle = useMempoolOracle(selectedNetwork)

  return useQuery({
    enabled,
    queryFn: async (): Promise<ChainTipExternalData> => {
      const [fees, mempool] = await Promise.all([
        oracle.getMemPoolFees().catch(() => null),
        oracle.getMemPool().catch(() => null)
      ])
      return {
        fees,
        mempool: mempool
          ? {
              count: mempool.count,
              total_fee: mempool.total_fee,
              vsize: mempool.vsize
            }
          : null
      }
    },
    queryKey: ['chaintip-external', selectedNetwork],
    staleTime: time.minutes(1)
  })
}
