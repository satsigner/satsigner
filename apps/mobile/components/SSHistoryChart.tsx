import { Canvas, Group, Path, rect } from '@shopify/react-native-skia'
import { format } from 'd3-format'
import { scaleLinear, scaleTime } from 'd3-scale'
import { area, curveStepAfter, line } from 'd3-shape'
import { memo, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import {
  MemoizedCursorRenderer,
  MemoizedHistoryChartAreaSeries,
  MemoizedHistoryChartUtxoSeries,
  MemoizedTransactionInfoRenderer,
  MemoizedXAxisRenderer,
  MemoizedXScaleRenderer,
  MemoizedYScaleRenderer
} from '@/components/SSHistoryChartRenderers'
import { useFiatData } from '@/hooks/useFiatData'
import {
  useHistoryChartGestures,
  useHistoryChartLabels,
  useHistoryChartViewport
} from '@/hooks/useHistoryChart'
import { useSFProFonts } from '@/hooks/useSFProFonts'
import { useChartSettingStore } from '@/store/chartSettings'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Rectangle } from '@/types/ui/geometry'
import {
  buildBalanceHistory,
  buildChartData,
  buildTransactionsMap,
  buildTxInfoLabels,
  buildTxXAxisLabels,
  buildUtxoLabels,
  buildUtxoRectangles,
  buildWalletAddresses,
  computeValidChartData,
  type HistoryChartData
} from '@/utils/historyChart'

type SSHistoryChartProps = {
  transactions: Transaction[]
  utxos: Utxo[]
  blockchainHeight?: number
}

function SSHistoryChart({
  transactions,
  utxos,
  blockchainHeight
}: SSHistoryChartProps) {
  const [
    showLabel,
    showAmount,
    showTransactionInfo,
    showOutputField,
    lockZoomToXAxis,
    showFiatOnChart,
    showFiatAtTxTime,
    showFiatPercentageChange
  ] = useChartSettingStore(
    useShallow((state) => [
      state.showLabel,
      state.showAmount,
      state.showTransactionInfo,
      state.showOutputField,
      state.lockZoomToXAxis,
      state.showFiatOnChart,
      state.showFiatAtTxTime,
      state.showFiatPercentageChange
    ])
  )

  const [fiatCurrency, btcPrice, satsToFiat] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.btcPrice,
      state.satsToFiat
    ])
  )
  const { showCurrentFiat, showHistoricalFiat } = useFiatData()
  const effectiveBtcPrice = showCurrentFiat ? btcPrice : 0

  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )
  const zeroPadding = useZeroPadding || currencyUnit === 'btc'

  const currentDate = useRef<Date>(new Date())
  const labelRectRef = useRef<{ rect: Rectangle; id: string }[]>([])
  const viewport = useHistoryChartViewport(currentDate)
  const {
    containerSize,
    cursorX,
    cursorY,
    endDate,
    handleLayout,
    scale,
    startY
  } = viewport

  const walletAddresses = useMemo(
    () => buildWalletAddresses(transactions, utxos),
    [transactions, utxos]
  )

  const chartData: HistoryChartData[] = useMemo(
    () => buildChartData(transactions, currentDate.current),
    [transactions]
  )

  const timeOffset =
    chartData.length > 0
      ? new Date(currentDate.current).setDate(
          currentDate.current.getDate() + 10
        ) - chartData[0].date.getTime()
      : 0
  const margin = { bottom: 80, left: 40, right: 10, top: 30 }

  const startDate = useMemo<Date>(
    () => new Date(endDate.getTime() - timeOffset / scale),
    [endDate, scale, timeOffset]
  )

  const balanceHistory = useMemo(
    () => buildBalanceHistory(transactions, walletAddresses),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walletAddresses]
  )

  const [maxBalance, validChartData] = useMemo(
    () =>
      computeValidChartData(
        chartData,
        startDate,
        endDate,
        currentDate.current,
        lockZoomToXAxis
      ),
    [chartData, lockZoomToXAxis, startDate, endDate]
  )

  const chartWidth = containerSize.width - margin.left - margin.right
  const chartHeight = containerSize.height - margin.top - margin.bottom

  const xScale = useMemo(
    () => scaleTime().domain([startDate, endDate]).range([0, chartWidth]),
    [chartWidth, endDate, startDate]
  )

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain([
          lockZoomToXAxis ? 0 : startY,
          lockZoomToXAxis
            ? maxBalance * 1.2
            : startY + (maxBalance * 1.2) / scale
        ])
        .range([chartHeight, 0]),
    [chartHeight, lockZoomToXAxis, maxBalance, scale, startY]
  )

  const utxoRectangleData = useMemo(
    () =>
      buildUtxoRectangles({
        balanceHistory,
        chartWidth,
        currentDate: currentDate.current,
        transactions,
        xScale,
        yScale
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balanceHistory, xScale, yScale]
  )

  const utxoLabels = useMemo(
    () =>
      buildUtxoLabels({
        balanceHistory,
        chartWidth,
        currentDate: currentDate.current,
        transactions,
        xScale,
        yScale
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balanceHistory, xScale, yScale]
  )

  const combinedGesture = useHistoryChartGestures({
    chartHeight,
    chartWidth,
    currentDate,
    labelRectRef,
    lockZoomToXAxis,
    margin,
    maxBalance,
    showOutputField,
    showTransactionInfo,
    timeOffset,
    transactions,
    utxoRectangleData,
    validChartData,
    viewport,
    xScale
  })

  const lineGenerator = useMemo(
    () =>
      line<HistoryChartData>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.balance))
        .curve(curveStepAfter),
    [xScale, yScale]
  )

  const areaGenerator = useMemo(
    () =>
      area<HistoryChartData>()
        .x((d) => xScale(d.date))
        .y0(chartHeight * scale)
        .y1((d) => yScale(d.balance))
        .curve(curveStepAfter),
    [chartHeight, scale, xScale, yScale]
  )

  const linePath = useMemo(
    () => lineGenerator(validChartData),
    [lineGenerator, validChartData]
  )
  const areaPath = useMemo(
    () => areaGenerator(validChartData),
    [areaGenerator, validChartData]
  )

  const yAxisFormatter = useMemo(() => format('.3s'), [])

  const txXAxisLabels = useMemo(
    () =>
      buildTxXAxisLabels({
        blockchainHeight,
        chartHeight,
        endDate,
        showTransactionInfo,
        startDate,
        transactions,
        walletAddresses,
        xScale,
        zeroPadding
      }),
    [
      walletAddresses,
      transactions,
      startDate,
      endDate,
      xScale,
      showTransactionInfo,
      chartHeight,
      zeroPadding,
      blockchainHeight
    ]
  )

  const transactionsMap = useMemo(
    () => buildTransactionsMap(transactions),
    [transactions]
  )

  const txInfoLabels = useMemo(
    () =>
      buildTxInfoLabels({
        chartHeight,
        chartWidth,
        effectiveBtcPrice,
        fiatCurrency,
        satsToFiat,
        showAmount,
        showFiatAtTxTime,
        showFiatOnChart,
        showHistoricalFiat,
        showLabel,
        transactionsMap,
        validChartData,
        xScale,
        yScale
      }),
    [
      showAmount,
      showLabel,
      validChartData,
      xScale,
      yScale,
      chartWidth,
      chartHeight,
      showFiatOnChart,
      showFiatAtTxTime,
      showHistoricalFiat,
      effectiveBtcPrice,
      satsToFiat,
      fiatCurrency,
      transactionsMap
    ]
  )

  const customFontManager = useSFProFonts()
  const fontStyle = {
    fontFamily: 'SF Pro Text',
    fontSize: 10
  } as const

  const labelParagraphs = useHistoryChartLabels({
    chartWidth,
    customFontManager,
    effectiveBtcPrice,
    fiatCurrency,
    showAmount,
    showFiatAtTxTime,
    showFiatOnChart,
    showFiatPercentageChange,
    showHistoricalFiat,
    showLabel,
    transactionsMap,
    txInfoLabels,
    zeroPadding
  })

  const clipPathRect = rect(0, 0, chartWidth, chartHeight)

  if (!containerSize.width || !containerSize.height) {
    return <View onLayout={handleLayout} style={styles.container} />
  }

  return (
    <GestureDetector gesture={combinedGesture}>
      <View style={styles.container} onLayout={handleLayout}>
        <Canvas
          style={{
            flex: 1,
            height: containerSize.height,
            width: containerSize.width
          }}
          pointerEvents="box-none"
        >
          <Group
            transform={[
              { translateX: margin.left },
              { translateY: margin.top }
            ]}
          >
            <MemoizedYScaleRenderer
              customFontManager={customFontManager}
              fontStyle={fontStyle}
              yScale={yScale}
              chartHeight={chartHeight}
              chartWidth={chartWidth}
              yAxisFormatter={yAxisFormatter}
            />
            <MemoizedXScaleRenderer
              customFontManager={customFontManager}
              fontStyle={fontStyle}
              showTransactionInfo={showTransactionInfo}
              txXAxisLabels={txXAxisLabels}
              chartHeight={chartHeight}
              zeroPadding={zeroPadding}
            />
            <MemoizedXAxisRenderer
              customFontManager={customFontManager}
              fontStyle={fontStyle}
              xScale={xScale}
              chartHeight={chartHeight}
              showTransactionInfo={showTransactionInfo}
            />
            <Group clip={clipPathRect}>
              <MemoizedHistoryChartUtxoSeries
                customFontManager={customFontManager}
                fontStyle={fontStyle}
                utxoRectangleData={utxoRectangleData}
                utxoLabels={utxoLabels}
                showOutputField={showOutputField}
              />
              <MemoizedTransactionInfoRenderer
                customFontManager={customFontManager}
                fontStyle={fontStyle}
                txInfoLabels={txInfoLabels}
                labelParagraphs={labelParagraphs}
                showLabel={showLabel}
                showAmount={showAmount}
                zeroPadding={zeroPadding}
                labelRectRef={labelRectRef}
              />
              <Path
                path={linePath ?? ''}
                color="white"
                strokeWidth={2}
                style="stroke"
              />
              <MemoizedHistoryChartAreaSeries
                areaPath={areaPath}
                showOutputField={showOutputField}
              />
              <MemoizedCursorRenderer
                customFontManager={customFontManager}
                fontStyle={fontStyle}
                cursorX={cursorX}
                cursorY={cursorY}
                xScale={xScale}
                chartHeight={chartHeight}
                zeroPadding={zeroPadding}
              />
            </Group>
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1
  }
})

export default memo(
  SSHistoryChart,
  (prevProps, nextProps) =>
    prevProps.transactions === nextProps.transactions &&
    prevProps.utxos === nextProps.utxos
)
