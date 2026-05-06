import { useFont } from '@shopify/react-native-skia'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { CartesianChart, Line } from 'victory-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSFeeRateChart from '@/components/SSFeeRateChart'
import SSText from '@/components/SSText'
import {
  useChainTipData,
  useChainTipMempoolStats,
  useChainTipPriceHistory
} from '@/hooks/useChainTipData'
import type { DataSource } from '@/hooks/useChainTipData'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { formatBytes, formatDate } from '@/utils/format'

const chartFont = require('@/assets/fonts/SF-Pro-Text-Medium.otf')

const tn = _tn('explorer.chaintip')

export default function ChainTip() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  const [showExternal, setShowExternal] = useState(false)

  const { data: chainData, isLoading } = useChainTipData()
  const { data: mempoolStatistics } = useChainTipMempoolStats(
    '2h',
    showExternal
  )
  const { data: priceHistoryResult } = useChainTipPriceHistory(
    fiatCurrency,
    showExternal
  )
  const priceChartFont = useFont(chartFont, 10)

  const priceChartData =
    priceHistoryResult?.timestamps?.length && priceHistoryResult?.prices?.length
      ? priceHistoryResult.timestamps.map((ts, i) => ({
          price: priceHistoryResult.prices[i] ?? 0,
          x: ts
        }))
      : []

  const priceChartDomain = (() => {
    if (priceChartData.length === 0) {
      return undefined
    }
    const prices = priceChartData.map((d) => d.price).filter((p) => p > 0)
    const xValues = priceChartData.map((d) => d.x)
    if (prices.length === 0 || xValues.length === 0) {
      return undefined
    }
    const minY = Math.min(...prices)
    const maxY = Math.max(...prices)
    const padY = (maxY - minY) * 0.1 || 1
    return {
      x: [Math.min(...xValues), Math.max(...xValues)] as [number, number],
      y: [minY - padY, maxY + padY] as [number, number]
    }
  })()

  function sourceLabel(src: DataSource) {
    return src === 'backend'
      ? `${server.name} (${server.backend})`
      : 'mempool.space'
  }

  function formatPriceChartDate(timestampSeconds: number) {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short'
    }).format(new Date(timestampSeconds * 1000))
  }

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="white" size="large" />
        </View>
      )}
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
                loading={isLoading}
              />
              <Row
                label={tn('timestamp')}
                value={
                  chainData?.block?.timestamp
                    ? formatDate(chainData.block.timestamp * 1000)
                    : '--'
                }
                loading={isLoading}
              />
              {chainData?.block?.tx_count !== undefined && (
                <Row
                  label={tn('transactions')}
                  value={chainData.block.tx_count.toLocaleString()}
                  loading={isLoading}
                />
              )}
              {chainData?.block?.size !== undefined && (
                <Row
                  label={tn('size')}
                  value={formatBytes(chainData.block.size)}
                  loading={isLoading}
                />
              )}
              {chainData?.block?.weight !== undefined && (
                <Row
                  label={tn('weight')}
                  value={formatBytes(chainData.block.weight)}
                  loading={isLoading}
                />
              )}
              <SSVStack gap="none">
                <SSText size="xs" style={styles.labelText}>
                  {tn('hash')}
                </SSText>
                <SSText size="xs" style={styles.hashText} numberOfLines={2}>
                  {isLoading ? '--' : (chainData?.hash ?? '--')}
                </SSText>
              </SSVStack>
            </SSVStack>
          </SSVStack>

          {/* Mempool (from backend if available) */}
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
                  loading={isLoading}
                />
              )}
              <Row
                label={tn('mempoolSize')}
                value={
                  chainData?.mempool?.vsize
                    ? formatBytes(chainData.mempool.vsize)
                    : '--'
                }
                loading={isLoading}
              />
              {chainData?.mempool?.total_fee !== undefined && (
                <Row
                  label={tn('mempoolFees')}
                  value={`${chainData.mempool.total_fee.toLocaleString()} sats`}
                  loading={isLoading}
                />
              )}
            </SSVStack>
          </SSVStack>

          {/* External data opt-in */}
          {!showExternal && (
            <SSVStack style={{ alignItems: 'center' }}>
              <SSButton
                label={tn('loadExternal')}
                variant="outline"
                onPress={() => setShowExternal(true)}
              />
              <SSText size="xs" style={styles.privacyNote}>
                {tn('externalNote')}
              </SSText>
            </SSVStack>
          )}

          {showExternal && (
            <>
              {/* Fee Rates — mempool.space */}
              <SSVStack gap="sm">
                <SectionHeader
                  title={tn('fees')}
                  source={chainData?.feesSource ?? 'mempool'}
                  sourceLabel={
                    chainData?.feesSource
                      ? sourceLabel(chainData.feesSource)
                      : 'mempool.space'
                  }
                />
                <SSVStack gap="xs">
                  <Row
                    label={tn('feesHigh')}
                    value={
                      chainData?.fees ? `${chainData.fees.high} sat/vB` : '--'
                    }
                    loading={isLoading}
                  />
                  <Row
                    label={tn('feesMedium')}
                    value={
                      chainData?.fees ? `${chainData.fees.medium} sat/vB` : '--'
                    }
                    loading={isLoading}
                  />
                  <Row
                    label={tn('feesLow')}
                    value={
                      chainData?.fees ? `${chainData.fees.low} sat/vB` : '--'
                    }
                    loading={isLoading}
                  />
                  <Row
                    label={tn('feesNone')}
                    value={
                      chainData?.fees ? `${chainData.fees.none} sat/vB` : '--'
                    }
                    loading={isLoading}
                  />
                </SSVStack>
                <SSVStack gap="sm" style={{ marginTop: 8 }}>
                  <SSFeeRateChart
                    mempoolStatistics={mempoolStatistics}
                    timeRange="2hours"
                  />
                </SSVStack>
              </SSVStack>

              {/* Price — mempool.space */}
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
            </>
          )}
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
  source: DataSource | null
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
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  priceChartWrapper: {
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    height: 200,
    marginTop: 8,
    overflow: 'hidden',
    padding: 12
  },
  privacyNote: {
    color: Colors.gray['600'],
    marginTop: 4,
    textAlign: 'center'
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
