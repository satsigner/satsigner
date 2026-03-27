import { useFont } from '@shopify/react-native-skia'
import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { CartesianChart, Line } from 'victory-native'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import SSFeeRateChart from '@/components/SSFeeRateChart'
import SSText from '@/components/SSText'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import type {
  Block,
  MemPoolFees,
  MempoolStatistics
} from '@/types/models/Blockchain'
import type { Network } from '@/types/settings/blockchain'
import { formatBytes, formatDate } from '@/utils/format'
import { time } from '@/utils/time'

const chartFont = require('@/assets/fonts/SF-Pro-Text-Medium.otf')

const tn = _tn('explorer.chaintip')

type SectionSource = 'backend' | 'mempool'
type MempoolStats = { count?: number; vsize?: number; total_fee?: number }

type ChainData = {
  height: number | null
  hash: string | null
  block: Partial<Block> | null
  fees: MemPoolFees | null
  mempool: MempoolStats | null
  blockSource: SectionSource
  feesSource: SectionSource
  mempoolSource: SectionSource
}

const DEFAULT_CHAIN_DATA: ChainData = {
  block: null,
  blockSource: 'mempool',
  fees: null,
  feesSource: 'mempool',
  hash: null,
  height: null,
  mempool: null,
  mempoolSource: 'mempool'
}

function safeClose(client: ElectrumClient | null): void {
  try {
    client?.close()
  } catch {}
}

async function fetchFromEsplora(
  esplora: Esplora,
  oracle: MempoolOracle
): Promise<Partial<ChainData>> {
  const data: Partial<ChainData> = {}

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
      } catch {}
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
      } catch {}
    })()
  ])

  return data
}

async function fetchFromElectrum(
  url: string,
  network: Network
): Promise<Partial<ChainData>> {
  const data: Partial<ChainData> = {}
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
            const header = await client!.getBlock(data.height)
            data.hash = header.getId()
            data.block = { height: data.height, timestamp: header.timestamp }
            data.blockSource = 'backend'
          }
        } catch {}
      })(),
      (async () => {
        try {
          const histogram = await client!.getMempoolFeeHistogram()
          if (histogram.length > 0) {
            const vsize = histogram.reduce((sum, [, size]) => sum + size, 0)
            data.mempool = { vsize }
            data.mempoolSource = 'backend'
          }
        } catch {}
      })()
    ])
  } catch {
    // connection init failed; will fall through to mempool fallback
  } finally {
    safeClose(client)
  }

  return data
}

async function fetchMempoolFallback(
  oracle: MempoolOracle,
  existing: Partial<ChainData>
): Promise<ChainData> {
  const data: ChainData = { ...DEFAULT_CHAIN_DATA, ...existing }

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
      } catch {}
    })(),
    (async () => {
      try {
        data.fees = await oracle.getMemPoolFees()
        data.feesSource = 'mempool'
      } catch {}
    })(),
    (async () => {
      if (data.mempool !== null) return
      try {
        const md = await oracle.getMemPool()
        data.mempool = {
          count: md.count,
          total_fee: md.total_fee,
          vsize: md.vsize
        }
        data.mempoolSource = 'mempool'
      } catch {}
    })()
  ])

  if (data.block === null && data.hash !== null) {
    try {
      data.block = await oracle.getBlock(data.hash)
      data.blockSource = 'mempool'
    } catch {}
  }

  return data
}

export default function ChainTip() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const fallbackOracle = useMempoolOracle(selectedNetwork)
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  const [chainData, setChainData] = useState<ChainData | null>(null)
  const [loading, setLoading] = useState(true)
  const priceChartFont = useFont(chartFont, 10)

  useEffect(() => {
    async function fetchData() {
      let partial: Partial<ChainData> = {}

      if (server.backend === 'esplora' && server.url) {
        const esplora = new Esplora(server.url)
        const oracle = new MempoolOracle(server.url)
        partial = await fetchFromEsplora(esplora, oracle)
      } else if (server.backend === 'electrum' && server.url) {
        partial = await fetchFromElectrum(server.url, selectedNetwork)
      }

      const full = await fetchMempoolFallback(fallbackOracle, partial)
      setChainData(full)
      setLoading(false)
    }
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [feeChartTimeRange] = useState<'week' | 'day' | '2hours'>('2hours')
  const { data: mempoolStatistics } = useQuery<MempoolStatistics[]>({
    queryFn: () =>
      fallbackOracle.getMempoolStatistics(
        feeChartTimeRange === '2hours'
          ? '2h'
          : feeChartTimeRange === 'day'
            ? '24h'
            : '1w'
      ),
    queryKey: ['chaintip-statistics', feeChartTimeRange],
    staleTime: time.minutes(5)
  })

  const PRICE_CHART_DAYS = 7
  const { data: priceHistoryResult } = useQuery<{
    timestamps: number[]
    prices: number[]
  }>({
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000)
      const timestamps = Array.from(
        { length: PRICE_CHART_DAYS },
        (_, i) => now - (PRICE_CHART_DAYS - 1 - i) * 86400
      )
      const prices = await fallbackOracle.getPricesAt(fiatCurrency, timestamps)
      return { timestamps, prices }
    },
    queryKey: ['chaintip-price-history', fiatCurrency],
    staleTime: time.minutes(10)
  })

  const priceChartData = useMemo(() => {
    if (
      !priceHistoryResult?.timestamps?.length ||
      !priceHistoryResult?.prices?.length
    )
      return []
    const { timestamps, prices } = priceHistoryResult
    return timestamps.map((ts, i) => ({ price: prices[i] ?? 0, x: ts }))
  }, [priceHistoryResult])

  const priceChartDomain = useMemo(() => {
    if (priceChartData.length === 0) return undefined
    const prices = priceChartData.map((d) => d.price).filter((p) => p > 0)
    const xValues = priceChartData.map((d) => d.x)
    if (prices.length === 0 || xValues.length === 0) return undefined
    const minY = Math.min(...prices)
    const maxY = Math.max(...prices)
    const padY = (maxY - minY) * 0.1 || 1
    const minX = Math.min(...xValues)
    const maxX = Math.max(...xValues)
    return {
      x: [minX, maxX] as [number, number],
      y: [minY - padY, maxY + padY] as [number, number]
    }
  }, [priceChartData])

  function formatPriceChartDate(timestampSeconds: number) {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short'
    }).format(new Date(timestampSeconds * 1000))
  }

  function sourceLabel(src: SectionSource) {
    return src === 'backend'
      ? `${server.name} (${server.backend})`
      : 'mempool.space'
  }

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="xl" style={{ paddingBottom: 32, paddingTop: 20 }}>
          {/* Latest Block */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('latestBlock')}
              source={chainData?.blockSource ?? null}
              sourceLabel={
                chainData?.blockSource
                  ? sourceLabel(chainData.blockSource)
                  : null
              }
            />
            <SSVStack gap="xs">
              <Row
                label={tn('height')}
                value={chainData?.height?.toLocaleString() ?? '--'}
                loading={loading}
              />
              <Row
                label={tn('timestamp')}
                value={
                  chainData?.block?.timestamp
                    ? formatDate(chainData.block.timestamp * 1000)
                    : '--'
                }
                loading={loading}
              />
              {(chainData?.block as Block)?.tx_count != null && (
                <Row
                  label={tn('transactions')}
                  value={(chainData!.block as Block).tx_count.toLocaleString()}
                  loading={loading}
                />
              )}
              {(chainData?.block as Block)?.size != null && (
                <Row
                  label={tn('size')}
                  value={formatBytes((chainData!.block as Block).size)}
                  loading={loading}
                />
              )}
              {(chainData?.block as Block)?.weight != null && (
                <Row
                  label={tn('weight')}
                  value={formatBytes((chainData!.block as Block).weight)}
                  loading={loading}
                />
              )}
              <SSVStack gap="none">
                <SSText size="xs" style={styles.labelText}>
                  {tn('hash')}
                </SSText>
                <SSText size="xs" style={styles.hashText} numberOfLines={2}>
                  {loading ? '--' : (chainData?.hash ?? '--')}
                </SSText>
              </SSVStack>
            </SSVStack>
          </SSVStack>

          {/* Fee Rates */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('fees')}
              source={chainData?.feesSource ?? null}
              sourceLabel={
                chainData?.feesSource ? sourceLabel(chainData.feesSource) : null
              }
            />
            <SSVStack gap="xs">
              <Row
                label={tn('feesHigh')}
                value={chainData?.fees ? `${chainData.fees.high} sat/vB` : '--'}
                loading={loading}
              />
              <Row
                label={tn('feesMedium')}
                value={
                  chainData?.fees ? `${chainData.fees.medium} sat/vB` : '--'
                }
                loading={loading}
              />
              <Row
                label={tn('feesLow')}
                value={chainData?.fees ? `${chainData.fees.low} sat/vB` : '--'}
                loading={loading}
              />
              <Row
                label={tn('feesNone')}
                value={chainData?.fees ? `${chainData.fees.none} sat/vB` : '--'}
                loading={loading}
              />
            </SSVStack>
            <SSVStack gap="sm" style={{ marginTop: 8 }}>
              <SSFeeRateChart
                mempoolStatistics={mempoolStatistics}
                timeRange={feeChartTimeRange}
              />
            </SSVStack>
          </SSVStack>

          {/* Mempool */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('mempool')}
              source={chainData?.mempoolSource ?? null}
              sourceLabel={
                chainData?.mempoolSource
                  ? sourceLabel(chainData.mempoolSource)
                  : null
              }
            />
            <SSVStack gap="xs">
              {chainData?.mempool?.count !== undefined && (
                <Row
                  label={tn('mempoolTxs')}
                  value={chainData.mempool.count.toLocaleString()}
                  loading={loading}
                />
              )}
              <Row
                label={tn('mempoolSize')}
                value={
                  chainData?.mempool?.vsize
                    ? formatBytes(chainData.mempool.vsize)
                    : '--'
                }
                loading={loading}
              />
              {chainData?.mempool?.total_fee !== undefined && (
                <Row
                  label={tn('mempoolFees')}
                  value={`${chainData.mempool.total_fee.toLocaleString()} sats`}
                  loading={loading}
                />
              )}
            </SSVStack>
          </SSVStack>

          {/* Price — always mempool.space */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('price')}
              source="mempool"
              sourceLabel="mempool.space"
            />
            <Row
              label={`BTC / ${fiatCurrency}`}
              value={
                btcPrice > 0
                  ? btcPrice.toLocaleString(undefined, {
                      maximumFractionDigits: 0
                    })
                  : '--'
              }
              loading={false}
            />
            {priceChartData.length > 0 && priceChartDomain && (
              <View style={styles.priceChartWrapper}>
                <SSText
                  size="xxs"
                  style={[styles.labelText, { marginBottom: 6 }]}
                >
                  {fiatCurrency} / BTC
                </SSText>
                <CartesianChart
                  data={priceChartData}
                  xKey="x"
                  yKeys={['price']}
                  domain={priceChartDomain}
                  padding={{ bottom: 32, left: 48, right: 16, top: 8 }}
                  axisOptions={{
                    axisSide: { x: 'bottom', y: 'left' },
                    font: priceChartFont ?? undefined,
                    formatXLabel: (v) => formatPriceChartDate(Number(v)),
                    formatYLabel: (v) =>
                      `${Number(v).toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      })} ${fiatCurrency}`,
                    labelColor: { x: '#787878', y: '#ffffff' },
                    labelOffset: { x: 6, y: 8 },
                    tickCount: { x: 7, y: 6 }
                  }}
                >
                  {({ points }) =>
                    points.price ? (
                      <Line
                        points={points.price}
                        color={Colors.mainGreen}
                        strokeWidth={2}
                        curveType="natural"
                        animate={{ type: 'spring' }}
                      />
                    ) : null
                  }
                </CartesianChart>
              </View>
            )}
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

function SectionHeader({
  title,
  source,
  sourceLabel
}: {
  title: string
  source: SectionSource | null
  sourceLabel: string | null
}) {
  return (
    <SSHStack justifyBetween style={{ alignItems: 'center' }}>
      <SSText uppercase size="md" style={styles.sectionTitle}>
        {title}
      </SSText>
      {source && sourceLabel && (
        <SSText
          size="xxs"
          style={
            source === 'backend' ? styles.sourceBackend : styles.sourceMempool
          }
        >
          {sourceLabel}
        </SSText>
      )}
    </SSHStack>
  )
}

function Row({
  label,
  value,
  loading
}: {
  label: string
  value: string
  loading: boolean
}) {
  return (
    <SSHStack justifyBetween style={styles.row}>
      <SSText size="sm" style={styles.labelText}>
        {label}
      </SSText>
      <SSText size="sm" style={styles.valueText}>
        {loading ? '--' : value}
      </SSText>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0
  },
  hashText: {
    color: Colors.gray['100'],
    fontFamily: 'monospace'
  },
  labelText: {
    color: Colors.gray['400']
  },
  priceChartWrapper: {
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    height: 200,
    marginTop: 8,
    overflow: 'hidden',
    padding: 12
  },
  row: {
    alignItems: 'center',
    paddingVertical: 4
  },
  sectionTitle: {
    color: Colors.gray['400'],
    letterSpacing: 1.5
  },
  sourceBackend: {
    color: Colors.mainGreen,
    opacity: 0.8
  },
  sourceMempool: {
    color: Colors.gray['500']
  },
  valueText: {
    color: Colors.gray['100']
  }
})
