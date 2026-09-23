import {
  Canvas,
  Group,
  Path,
  rect,
  Skia,
  type SkParagraph,
  TextAlign
} from '@shopify/react-native-skia'
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
  useHistoryChartViewport
} from '@/hooks/useHistoryChart'
import { useSFProFonts } from '@/hooks/useSFProFonts'
import { useChartSettingStore } from '@/store/chartSettings'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Rectangle } from '@/types/ui/geometry'
import {
  formatFiatPrice,
  formatNumber,
  formatPercentualChange
} from '@/utils/format'
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
  hexToRgba,
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

  const labelParagraphs = useMemo(() => {
    if (!customFontManager) {
      return new Map<string, SkParagraph>()
    }
    const paragraphs = new Map<string, SkParagraph>()

    for (const label of txInfoLabels) {
      if (label.type === 'end') {
        continue
      }
      const { x } = label
      if (x < 0 || x > chartWidth) {
        continue
      }

      const baseColor = label.type === 'receive' ? '#A7FFAF' : '#FF7171'
      const baseStyle = {
        color: Skia.Color(baseColor),
        fontFamilies: ['SF Pro Text'],
        fontSize: 10
      }

      const transaction = transactionsMap.get(label.id)
      const historicalPrice =
        showHistoricalFiat &&
        transaction?.prices &&
        transaction.prices[fiatCurrency]
          ? transaction.prices[fiatCurrency]
          : undefined
      const hasHistoricalPrice =
        showHistoricalFiat && historicalPrice && effectiveBtcPrice > 0
      const needsSecondLine =
        (showFiatOnChart && label.fiatValue !== undefined) ||
        (showFiatPercentageChange && hasHistoricalPrice)

      const para = Skia.ParagraphBuilder.Make(
        {
          maxLines: needsSecondLine ? 2 : 1,
          textAlign: TextAlign.Left
        },
        customFontManager
      )

      if (showLabel && label.memo) {
        para.pushStyle(baseStyle).addText(label.memo).pop()
      } else if (showAmount && label.amount !== undefined) {
        const amountString = `${label.amount >= 0 ? '+' : ''}${formatNumber(
          label.amount,
          0,
          zeroPadding
        )}`
        const sign =
          amountString.startsWith('+') || amountString.startsWith('-')
            ? amountString[0]
            : ''
        const numberPart = sign ? amountString.substring(1) : amountString

        if (sign) {
          para.pushStyle(baseStyle).addText(sign).pop()
        }

        const firstNonZeroIndex = numberPart.search(/[1-9]/)
        if (firstNonZeroIndex === -1) {
          para
            .pushStyle({
              ...baseStyle,
              color: Skia.Color(baseColor)
            })
            .addText(numberPart)
            .pop()
        } else {
          const leadingZeros = numberPart.substring(0, firstNonZeroIndex)
          const significantDigits = numberPart.substring(firstNonZeroIndex)
          if (leadingZeros.length > 0) {
            const baseColorRgb = baseColor.match(
              /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i
            )
            const opacityColor = baseColorRgb
              ? Skia.Color(
                  `rgba(${parseInt(baseColorRgb[1], 16)}, ${parseInt(baseColorRgb[2], 16)}, ${parseInt(baseColorRgb[3], 16)}, 0.4)`
                )
              : Skia.Color('#999999')
            para
              .pushStyle({
                ...baseStyle,
                color: opacityColor
              })
              .addText(leadingZeros)
              .pop()
          }
          if (significantDigits.length > 0) {
            para
              .pushStyle({
                ...baseStyle,
                color: Skia.Color(baseColor)
              })
              .addText(significantDigits)
              .pop()
          }
        }
      }

      if (
        showFiatOnChart &&
        effectiveBtcPrice > 0 &&
        label.fiatValue !== undefined &&
        label.amount !== undefined
      ) {
        const currentPriceText = `≈ ${formatFiatPrice(label.amount, effectiveBtcPrice)} ${fiatCurrency}`
        const historicalPriceText =
          showFiatAtTxTime &&
          showHistoricalFiat &&
          historicalPrice &&
          label.amount !== undefined
            ? ` (${formatFiatPrice(label.amount, historicalPrice)} ${fiatCurrency})`
            : ''
        const percentageChangeText =
          showFiatPercentageChange &&
          showHistoricalFiat &&
          historicalPrice &&
          effectiveBtcPrice > 0
            ? formatPercentualChange(effectiveBtcPrice, historicalPrice)
            : ''

        para
          .pushStyle({
            color: Skia.Color('#666666'),
            fontFamilies: ['SF Pro Text'],
            fontSize: 8
          })
          .addText(`\n${currentPriceText}${historicalPriceText}`)
          .pop()

        if (percentageChangeText) {
          const isPositive = percentageChangeText[0] === '+'
          const baseColor = isPositive ? Colors.mainGreen : Colors.mainRed
          const percentageColor = hexToRgba(baseColor, 0.7)

          para
            .pushStyle({
              color: Skia.Color(percentageColor),
              fontFamilies: ['SF Pro Text'],
              fontSize: 8
            })
            .addText(` ${percentageChangeText}`)
            .pop()
        }
      } else if (
        showFiatPercentageChange &&
        showHistoricalFiat &&
        historicalPrice &&
        effectiveBtcPrice > 0 &&
        label.amount !== undefined
      ) {
        const percentageChangeText = formatPercentualChange(
          effectiveBtcPrice,
          historicalPrice
        )
        const isPositive = percentageChangeText[0] === '+'
        const baseColor = isPositive ? Colors.mainGreen : Colors.mainRed
        const percentageColor = hexToRgba(baseColor, 0.7)

        para
          .pushStyle({
            color: Skia.Color(percentageColor),
            fontFamilies: ['SF Pro Text'],
            fontSize: 8
          })
          .addText(`\n ${percentageChangeText}`)
          .pop()
      }

      const builtPara = para.build()
      builtPara.layout(10000)
      paragraphs.set(label.index, builtPara)
    }

    return paragraphs
  }, [
    txInfoLabels,
    customFontManager,
    showLabel,
    showAmount,
    zeroPadding,
    chartWidth,
    showFiatOnChart,
    showFiatAtTxTime,
    showFiatPercentageChange,
    showHistoricalFiat,
    effectiveBtcPrice,
    fiatCurrency,
    transactionsMap
  ])

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
