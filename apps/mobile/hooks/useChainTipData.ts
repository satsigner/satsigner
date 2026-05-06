import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import type { Block, MemPool, MemPoolFees } from '@/types/models/Blockchain'
import type { Network } from '@/types/settings/blockchain'
import { time } from '@/utils/time'

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

function safeClose(client: ElectrumClient | null): void {
  try {
    client?.close()
  } catch {
    /* silently ignored */
  }
}

async function fromEsplora(
  esplora: Esplora,
  oracle: MempoolOracle
): Promise<Partial<ChainTipData>> {
  const data: Partial<ChainTipData> = {}
  await Promise.all([
    (async () => {
      try {
        const [rawHeight, rawHash] = await Promise.all([
          esplora.getLatestBlockHeight(),
          esplora.getLatestBlockHash()
        ])
        data.height = Number(rawHeight)
        data.hash = String(rawHash)
        data.block = await oracle.getBlock(data.hash)
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
    })()
  ])
  return data
}

async function fromElectrum(
  url: string,
  network: Network
): Promise<Partial<ChainTipData>> {
  const data: Partial<ChainTipData> = {}
  let client: ElectrumClient | null = null
  try {
    client = ElectrumClient.fromUrl(url, network)
    await client.init()
    await Promise.all([
      (async () => {
        try {
          const tip = await client!.subscribeToBlockHeaders()
          if (tip?.height) {
            data.height = tip.height
            const header = await client!.getBlock(tip.height)
            data.hash = header.getId()
            data.block = { height: tip.height, timestamp: header.timestamp }
            data.blockSource = 'backend'
          }
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

async function fillFromMempoolFallback(
  oracle: MempoolOracle,
  partial: Partial<ChainTipData>
): Promise<ChainTipData> {
  const data: ChainTipData = {
    block: partial.block ?? null,
    blockSource: partial.blockSource ?? 'mempool',
    fees: partial.fees ?? null,
    feesSource: partial.feesSource ?? 'mempool',
    hash: partial.hash ?? null,
    height: partial.height ?? null,
    mempool: partial.mempool ?? null,
    mempoolSource: partial.mempoolSource ?? 'mempool'
  }

  await Promise.all([
    (async () => {
      try {
        const [mHeight, mHash] = await Promise.all([
          data.height === null ? oracle.getCurrentBlockHeight() : null,
          data.hash === null ? oracle.getCurrentBlockHash() : null
        ])
        if (data.height === null && mHeight !== null) {
          data.height = mHeight
          data.blockSource = 'mempool'
        }
        if (data.hash === null && mHash !== null) {
          data.hash = mHash
        }
      } catch {
        /* silently ignored */
      }
    })(),
    (async () => {
      try {
        data.fees = await oracle.getMemPoolFees()
        data.feesSource = 'mempool'
      } catch {
        /* silently ignored */
      }
    })(),
    (async () => {
      if (data.mempool !== null) {
        return
      }
      try {
        const md = (await oracle.getMemPool()) as MemPool
        data.mempool = {
          count: md.count,
          total_fee: md.total_fee,
          vsize: md.vsize
        }
        data.mempoolSource = 'mempool'
      } catch {
        /* silently ignored */
      }
    })()
  ])

  if (data.block === null && data.hash !== null) {
    try {
      data.block = await oracle.getBlock(data.hash)
      data.blockSource = 'mempool'
    } catch {
      /* silently ignored */
    }
  }

  return data
}

async function fetchChainTipData(
  serverUrl: string,
  backend: string,
  network: Network,
  oracle: MempoolOracle
): Promise<ChainTipData> {
  let partial: Partial<ChainTipData> = {}

  if (backend === 'esplora' && serverUrl) {
    const esplora = new Esplora(serverUrl)
    const localOracle = new MempoolOracle(serverUrl)
    partial = await fromEsplora(esplora, localOracle)
  } else if (backend === 'electrum' && serverUrl) {
    partial = await fromElectrum(serverUrl, network)
  }

  return fillFromMempoolFallback(oracle, partial)
}

export function useChainTipData() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const oracle = useMempoolOracle(selectedNetwork)

  return useQuery({
    queryFn: () =>
      fetchChainTipData(server.url, server.backend, selectedNetwork, oracle),
    queryKey: ['chain-tip', server.url, server.backend, selectedNetwork],
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
