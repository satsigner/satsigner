import { useFont } from '@shopify/react-native-skia'
import { router, Stack } from 'expo-router'
import { useState, type ComponentProps, type ReactElement } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { CartesianChart, Line } from 'victory-native'
import { useShallow } from 'zustand/react/shallow'

import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSFeeRateChart from '@/components/SSFeeRateChart'
import SSLoader from '@/components/SSLoader'
import SSText from '@/components/SSText'
import {
  PRICE_CHART_DAYS,
  useChainTipData,
  useChainTipExternalData,
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
import type { MemPoolFees } from '@/types/models/Blockchain'
import { formatBytes, formatDate, formatPercentualChange } from '@/utils/format'
import {
  MAIN_HORIZONTAL_PAD_RATIO,
  PRICE_CHART_HEIGHT,
  PRICE_CHART_LOADER_SIZE,
  PRICE_CHART_PADDING,
  PRICE_CHART_TICK_COUNT,
  type PriceChartDomain,
  type PriceChartPoint,
  formatPriceChartXLabel,
  formatPriceChartYLabel,
  formatSpotPriceDisplay,
  priceDomainFromData
} from '@/utils/priceChart'

const chartFont = require('@/assets/fonts/SF-Pro-Text-Medium.otf')

const tn = _tn('explorer.chaintip')

type PriceChartRenderArgs = {
  points: {
    price?: ComponentProps<typeof Line>['points']
  }
}

function renderPriceChartLine({
  points
}: PriceChartRenderArgs): ReactElement | null {
  if (!points.price) {
    return null
  }
  return (
    <Line
      points={points.price}
      color={Colors.white}
      strokeWidth={1.5}
      curveType="linear"
    />
  )
}

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
  const { data: externalData, isLoading: isLoadingExternal } =
    useChainTipExternalData(showExternal)
  const { data: mempoolStatistics } = useChainTipMempoolStats(
    '2h',
    showExternal
  )
  const { data: priceHistoryResult, isLoading: isLoadingPrice } =
    useChainTipPriceHistory(fiatCurrency, showExternal)
  const priceChartFont = useFont(chartFont, 10)

  const priceChartData =
    priceHistoryResult?.timestamps?.length && priceHistoryResult?.prices?.length
      ? priceHistoryResult.timestamps.map((ts, i) => ({
          price: priceHistoryResult.prices[i] ?? 0,
          x: ts
        }))
      : []

  const priceChartDomain = priceDomainFromData(priceChartData)
  const chartSpotPrice = priceChartData.at(-1)?.price ?? 0
  const spotPrice = btcPrice > 0 ? btcPrice : chartSpotPrice
  const firstChartPrice = priceChartData.find((d) => d.price > 0)?.price
  const priceChangeLabel =
    firstChartPrice && chartSpotPrice > 0
      ? formatPercentualChange(chartSpotPrice, firstChartPrice)
      : null

  function sourceLabel(src: DataSource) {
    return src === 'backend'
      ? `${server.name} (${server.backend})`
      : 'mempool.space'
  }

  function openTipBlock() {
    if (typeof chainData?.height !== 'number') {
      return
    }
    router.push(`/explorer/block/${chainData.height}`)
  }

  function enableExternal() {
    setShowExternal(true)
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
          <SSLoader size={80} />
        </View>
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SSVStack gap="xl" widthFull style={styles.scrollStack}>
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
              <Pressable
                onPress={openTipBlock}
                disabled={typeof chainData?.height !== 'number'}
              >
                <Row
                  label={tn('height')}
                  value={chainData?.height?.toLocaleString() ?? '--'}
                  loading={isLoading}
                />
              </Pressable>
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
              {typeof chainData?.height === 'number' ? (
                <Pressable onPress={openTipBlock}>
                  <SSText size="xs" style={styles.linkText}>
                    {tn('viewBlock')}
                  </SSText>
                </Pressable>
              ) : null}
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

          {chainData?.feesSource === 'backend' && chainData.fees ? (
            <FeeRatesSection
              fees={chainData.fees}
              source={chainData.feesSource}
              sourceLabel={sourceLabel(chainData.feesSource)}
              loading={isLoading}
            />
          ) : null}

          {!showExternal ? (
            <SSExplorerCapabilityBanner
              why={tn('externalWhy')}
              fix={tn('externalNote')}
              onLoad={enableExternal}
              loadLabel={tn('loadExternal')}
              loading={isLoadingExternal}
            />
          ) : null}

          {showExternal && (
            <>
              {chainData?.feesSource !== 'backend' ? (
                <FeeRatesSection
                  fees={externalData?.fees ?? null}
                  source="mempool"
                  sourceLabel="mempool.space"
                  loading={isLoadingExternal}
                />
              ) : null}
              <SSVStack gap="sm" style={{ marginTop: 8 }}>
                <SSFeeRateChart
                  mempoolStatistics={mempoolStatistics}
                  timeRange="2hours"
                />
              </SSVStack>

              <PriceSection
                fiatCurrency={fiatCurrency}
                spotPrice={spotPrice}
                priceChangeLabel={priceChangeLabel}
                priceChartData={priceChartData}
                priceChartDomain={priceChartDomain}
                priceChartFont={priceChartFont}
                loading={isLoadingPrice}
              />
            </>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

function PriceSection({
  fiatCurrency,
  spotPrice,
  priceChangeLabel,
  priceChartData,
  priceChartDomain,
  priceChartFont,
  loading
}: {
  fiatCurrency: string
  spotPrice: number
  priceChangeLabel: string | null
  priceChartData: PriceChartPoint[]
  priceChartDomain: PriceChartDomain | undefined
  priceChartFont: ReturnType<typeof useFont>
  loading: boolean
}) {
  const { width: screenWidth } = useWindowDimensions()
  const chartBleedStyle = {
    marginLeft: -screenWidth * MAIN_HORIZONTAL_PAD_RATIO,
    width: screenWidth
  }
  const changePositive =
    priceChangeLabel !== null && priceChangeLabel.startsWith('+')
  const spotPriceLabel = formatSpotPriceDisplay(loading, spotPrice)

  return (
    <SSVStack gap="sm" widthFull>
      <SectionHeader
        title={tn('price')}
        source="mempool"
        sourceLabel="mempool.space"
      />
      <SSVStack gap="none" widthFull>
        <SSHStack gap="sm" style={styles.priceSpotRow}>
          <SSText size="3xl" type="mono" weight="light">
            {spotPriceLabel}
          </SSText>
          <SSText size="md" color="muted">
            {fiatCurrency}
          </SSText>
        </SSHStack>
        {priceChangeLabel ? (
          <SSHStack gap="xs" style={styles.priceChangeRow}>
            <SSText
              size="xs"
              type="mono"
              style={
                changePositive ? styles.priceChangeUp : styles.priceChangeDown
              }
            >
              {priceChangeLabel}
            </SSText>
            <SSText size="xs" color="muted">
              {tn('priceChangePeriod', { days: PRICE_CHART_DAYS })}
            </SSText>
          </SSHStack>
        ) : null}
      </SSVStack>
      {loading && priceChartData.length === 0 ? (
        <View style={[styles.priceChartLoading, chartBleedStyle]}>
          <SSLoader size={PRICE_CHART_LOADER_SIZE} />
        </View>
      ) : null}
      {priceChartData.length > 0 && priceChartDomain ? (
        <View style={[styles.priceChartWrapper, chartBleedStyle]}>
          <CartesianChart
            data={priceChartData}
            xKey="x"
            yKeys={['price']}
            domain={priceChartDomain}
            padding={PRICE_CHART_PADDING}
            axisOptions={{
              axisSide: { x: 'bottom', y: 'right' },
              font: priceChartFont ?? undefined,
              formatXLabel: formatPriceChartXLabel,
              formatYLabel: formatPriceChartYLabel,
              labelColor: {
                x: Colors.gray[500],
                y: Colors.gray[300]
              },
              labelOffset: { x: 4, y: 18 },
              tickCount: PRICE_CHART_TICK_COUNT
            }}
          >
            {renderPriceChartLine}
          </CartesianChart>
        </View>
      ) : null}
      {!loading && priceChartData.length === 0 ? (
        <SSText size="sm" color="muted">
          {tn('priceChartEmpty')}
        </SSText>
      ) : null}
    </SSVStack>
  )
}

function FeeRatesSection({
  fees,
  source,
  sourceLabel,
  loading
}: {
  fees: MemPoolFees | null
  source: DataSource
  sourceLabel: string
  loading: boolean
}) {
  return (
    <SSVStack gap="sm">
      <SectionHeader
        title={tn('fees')}
        source={source}
        sourceLabel={sourceLabel}
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
    </SSVStack>
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
  linkText: {
    color: Colors.white,
    marginTop: 4,
    textDecorationLine: 'underline'
  },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  priceChangeDown: {
    color: Colors.mainRed
  },
  priceChangeRow: {
    alignItems: 'center',
    marginTop: -2
  },
  priceChangeUp: {
    color: Colors.mainGreen
  },
  priceChartLoading: {
    alignItems: 'center',
    height: 200,
    justifyContent: 'center'
  },
  priceChartWrapper: {
    height: PRICE_CHART_HEIGHT
  },
  priceSpotRow: {
    alignItems: 'baseline'
  },
  row: {
    alignItems: 'center',
    paddingVertical: 4
  },
  scrollContent: {
    width: '100%'
  },
  scrollStack: {
    paddingBottom: 32,
    paddingTop: 20,
    width: '100%'
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
