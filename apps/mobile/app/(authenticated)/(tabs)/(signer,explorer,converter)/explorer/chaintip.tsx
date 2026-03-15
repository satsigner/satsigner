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
import { formatDate } from '@/utils/format'
import { time } from '@/utils/time'

const chartFont = require('@/assets/fonts/SF-Pro-Text-Medium.otf')

const tn = _tn('explorer.chaintip')

type SectionSource = 'backend' | 'mempool'
type MempoolStats = { count?: number; vsize?: number; total_fee?: number }

export default function ChainTip() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const fallbackOracle = useMempoolOracle(selectedNetwork)
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  const [blockHeight, setBlockHeight] = useState<number | null>(null)
  const [blockHash, setBlockHash] = useState<string | null>(null)
  const [block, setBlock] = useState<Partial<Block> | null>(null)
  const [fees, setFees] = useState<MemPoolFees | null>(null)
  const [mempool, setMempool] = useState<MempoolStats | null>(null)
  const [blockSource, setBlockSource] = useState<SectionSource | null>(null)
  const [feesSource, setFeesSource] = useState<SectionSource | null>(null)
  const [mempoolSource, setMempoolSource] = useState<SectionSource | null>(null)
  const [loading, setLoading] = useState(true)
  const priceChartFont = useFont(chartFont, 10)

  useEffect(() => {
    async function fetchData() {
      let bHeight: number | null = null
      let bHash: string | null = null
      let bBlock: Partial<Block> | null = null
      let bFees: MemPoolFees | null = null
      let bMempool: MempoolStats | null = null
      let bBlockSource: SectionSource = 'mempool'
      let bFeesSource: SectionSource = 'mempool'
      let bMempoolSource: SectionSource = 'mempool'

      // ── Esplora backend ───────────────────────────────────────────────────
      if (server.backend === 'esplora' && server.url) {
        const esplora = new Esplora(server.url)
        const oracle = new MempoolOracle(server.url)

        await Promise.all([
          // Block
          (async () => {
            try {
              const [rawHeight, rawHash] = await Promise.all([
                esplora.getLatestBlockHeight(),
                esplora.getLatestBlockHash()
              ])
              bHeight = Number(rawHeight)
              bHash = String(rawHash)
              bBlock = await oracle.getBlock(bHash)
              bBlockSource = 'backend'
            } catch {}
          })(),
          // Fees: always from mempool.space (fetched in fallback below)
          // Mempool
          (async () => {
            try {
              const info = await esplora.getMempoolInfo()
              if (info) {
                bMempool = {
                  count: info.count,
                  vsize: info.vsize,
                  total_fee: info.total_fee
                }
                bMempoolSource = 'backend'
              }
            } catch {}
          })()
        ])
      }

      // ── Electrum backend ──────────────────────────────────────────────────
      else if (server.backend === 'electrum' && server.url) {
        let client: ElectrumClient | null = null
        try {
          client = ElectrumClient.fromUrl(server.url, selectedNetwork)
          await client.init()

          await Promise.all([
            // Block tip via headers subscribe, then fetch header for hash + timestamp
            (async () => {
              try {
                const tip = await (
                  client!.client as any
                ).blockchainHeaders_subscribe()
                if (tip?.height) {
                  bHeight = tip.height as number
                  // getBlock(height) returns a bitcoinjs.Block with timestamp + getId()
                  const header = await client!.getBlock(bHeight)
                  bHash = header.getId()
                  bBlock = { height: bHeight, timestamp: header.timestamp }
                  bBlockSource = 'backend'
                }
              } catch {}
            })(),
            // Fees: always from mempool.space (fetched in fallback below)
            // Mempool histogram → total vsize
            (async () => {
              try {
                const histogram = await (
                  client!.client as any
                ).mempool_get_fee_histogram?.()
                if (Array.isArray(histogram) && histogram.length > 0) {
                  const vsize = histogram.reduce(
                    (sum: number, item: [number, number]) =>
                      sum + (item[1] ?? 0),
                    0
                  )
                  bMempool = { vsize }
                  bMempoolSource = 'backend'
                }
              } catch {}
            })()
          ])
        } catch {
          // connection init failed; will fall through to mempool fallback
        } finally {
          try {
            client?.close()
          } catch {}
        }
      }

      // ── Mempool fallback for anything still missing ───────────────────────
      await Promise.all([
        // Block height + hash
        (async () => {
          try {
            const [mHeight, mHash] = await Promise.all([
              bHeight === null ? fallbackOracle.getCurrentBlockHeight() : null,
              bHash === null ? fallbackOracle.getCurrentBlockHash() : null
            ])
            if (bHeight === null && mHeight !== null) {
              bHeight = mHeight
              bBlockSource = 'mempool'
            }
            if (bHash === null && mHash !== null) {
              bHash = mHash
            }
          } catch {}
        })(),
        // Block details
        (async () => {
          if (bBlock !== null) return
          try {
            // Need hash first — may be set by the parallel height/hash fetch above,
            // but in fallback order we fetch hash above and block here after.
            // We'll check bHash after the above resolves. Handled below.
          } catch {}
        })(),
        // Fees: always from mempool.space
        (async () => {
          try {
            bFees = await fallbackOracle.getMemPoolFees()
            bFeesSource = 'mempool'
          } catch {}
        })(),
        // Mempool stats
        (async () => {
          if (bMempool !== null) return
          try {
            const md = await fallbackOracle.getMemPool()
            bMempool = {
              count: md.count,
              vsize: md.vsize,
              total_fee: md.total_fee
            }
            bMempoolSource = 'mempool'
          } catch {}
        })()
      ])

      // Block details fallback: needs hash to be resolved first
      if (bBlock === null && bHash !== null) {
        try {
          bBlock = await fallbackOracle.getBlock(bHash)
          bBlockSource = 'mempool'
        } catch {}
      }

      setBlockHeight(bHeight)
      setBlockHash(bHash)
      setBlock(bBlock)
      setFees(bFees)
      setMempool(bMempool)
      setBlockSource(bBlockSource)
      setFeesSource(bFeesSource)
      setMempoolSource(bMempoolSource)
      setLoading(false)
    }
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [feeChartTimeRange] = useState<'week' | 'day' | '2hours'>('2hours')
  const { data: mempoolStatistics } = useQuery<MempoolStatistics[]>({
    queryKey: ['chaintip-statistics', feeChartTimeRange],
    queryFn: () =>
      fallbackOracle.getMempoolStatistics(
        feeChartTimeRange === '2hours'
          ? '2h'
          : feeChartTimeRange === 'day'
            ? '24h'
            : '1w'
      ),
    staleTime: time.minutes(5)
  })

  const PRICE_CHART_DAYS = 7
  const { data: priceHistoryResult } = useQuery<{
    timestamps: number[]
    prices: number[]
  }>({
    queryKey: ['chaintip-price-history', fiatCurrency],
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000)
      const timestamps = Array.from(
        { length: PRICE_CHART_DAYS },
        (_, i) => now - (PRICE_CHART_DAYS - 1 - i) * 86400
      )
      const prices = await fallbackOracle.getPricesAt(fiatCurrency, timestamps)
      return { timestamps, prices }
    },
    staleTime: time.minutes(10)
  })

  const priceChartData = useMemo(() => {
    if (
      !priceHistoryResult?.timestamps?.length ||
      !priceHistoryResult?.prices?.length
    )
      return []
    const { timestamps, prices } = priceHistoryResult
    return timestamps.map((ts, i) => ({ x: ts, price: prices[i] ?? 0 }))
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
      month: 'short',
      day: 'numeric'
    }).format(new Date(timestampSeconds * 1000))
  }

  function formatBytes(bytes: number) {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`
    return `${bytes} B`
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
        <SSVStack gap="xl" style={{ paddingTop: 20, paddingBottom: 32 }}>
          {/* Latest Block */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('latestBlock')}
              source={blockSource}
              sourceLabel={blockSource ? sourceLabel(blockSource) : null}
            />
            <SSVStack gap="xs">
              <Row
                label={tn('height')}
                value={blockHeight?.toLocaleString() ?? '--'}
                loading={loading}
              />
              <Row
                label={tn('timestamp')}
                value={
                  block?.timestamp ? formatDate(block.timestamp * 1000) : '--'
                }
                loading={loading}
              />
              {(block as Block)?.tx_count != null && (
                <Row
                  label={tn('transactions')}
                  value={(block as Block).tx_count.toLocaleString()}
                  loading={loading}
                />
              )}
              {(block as Block)?.size != null && (
                <Row
                  label={tn('size')}
                  value={formatBytes((block as Block).size)}
                  loading={loading}
                />
              )}
              {(block as Block)?.weight != null && (
                <Row
                  label={tn('weight')}
                  value={formatBytes((block as Block).weight)}
                  loading={loading}
                />
              )}
              <SSVStack gap="none">
                <SSText size="xs" style={styles.labelText}>
                  {tn('hash')}
                </SSText>
                <SSText size="xs" style={styles.hashText} numberOfLines={2}>
                  {loading ? '--' : blockHash ?? '--'}
                </SSText>
              </SSVStack>
            </SSVStack>
          </SSVStack>

          {/* Fee Rates */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('fees')}
              source={feesSource}
              sourceLabel={feesSource ? sourceLabel(feesSource) : null}
            />
            <SSVStack gap="xs">
              <Row
                label={tn('feesHigh')}
                value={fees ? `${fees.high} sat/vB` : '--'}
                loading={loading}
              />
              <Row
                label={tn('feesMedium')}
                value={fees ? `${fees.medium} sat/vB` : '--'}
                loading={loading}
              />
              <Row
                label={tn('feesLow')}
                value={fees ? `${fees.low} sat/vB` : '--'}
                loading={loading}
              />
              <Row
                label={tn('feesNone')}
                value={fees ? `${fees.none} sat/vB` : '--'}
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
              source={mempoolSource}
              sourceLabel={mempoolSource ? sourceLabel(mempoolSource) : null}
            />
            <SSVStack gap="xs">
              {mempool?.count !== undefined && (
                <Row
                  label={tn('mempoolTxs')}
                  value={mempool.count.toLocaleString()}
                  loading={loading}
                />
              )}
              <Row
                label={tn('mempoolSize')}
                value={mempool?.vsize ? formatBytes(mempool.vsize) : '--'}
                loading={loading}
              />
              {mempool?.total_fee !== undefined && (
                <Row
                  label={tn('mempoolFees')}
                  value={`${mempool.total_fee.toLocaleString()} sats`}
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
                  padding={{ left: 48, right: 16, top: 8, bottom: 32 }}
                  axisOptions={{
                    font: priceChartFont ?? undefined,
                    formatXLabel: (v) => formatPriceChartDate(Number(v)),
                    formatYLabel: (v) =>
                      `${Number(v).toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      })} ${fiatCurrency}`,
                    axisSide: { x: 'bottom', y: 'left' },
                    labelColor: { x: '#787878', y: '#ffffff' },
                    tickCount: { x: 7, y: 6 },
                    labelOffset: { x: 6, y: 8 }
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
  sectionTitle: {
    color: Colors.gray['400'],
    letterSpacing: 1.5
  },
  row: {
    alignItems: 'center',
    paddingVertical: 4
  },
  labelText: {
    color: Colors.gray['400']
  },
  valueText: {
    color: Colors.gray['100']
  },
  hashText: {
    color: Colors.gray['100'],
    fontFamily: 'monospace'
  },
  sourceBackend: {
    color: Colors.mainGreen,
    opacity: 0.8
  },
  sourceMempool: {
    color: Colors.gray['500']
  },
  priceChartWrapper: {
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    height: 200,
    marginTop: 8,
    overflow: 'hidden',
    padding: 12
  }
})
