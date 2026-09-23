import {
  Canvas,
  DashPathEffect,
  Group,
  Line,
  LinearGradient,
  matchFont,
  Paragraph,
  Path,
  Rect,
  rect,
  Skia,
  type SkParagraph,
  Text,
  TextAlign,
  TileMode,
  vec
} from '@shopify/react-native-skia'
import { format } from 'd3-format'
import {
  type ScaleLinear,
  type ScaleTime,
  scaleLinear,
  scaleTime
} from 'd3-scale'
import { area, curveStepAfter, line } from 'd3-shape'
import { timeFormat } from 'd3-time-format'
import { Fragment, memo, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

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
import { getUtxoOutpoint } from '@/utils/utxo'

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
              {showOutputField && (
                <>
                  <MemoizedUtxoRectRenderer
                    utxoRectangleData={utxoRectangleData}
                    showOutputField={showOutputField}
                  />
                  <MemoizedUtxoLabelRenderer
                    customFontManager={customFontManager}
                    fontStyle={fontStyle}
                    utxoLabels={utxoLabels}
                    showOutputField={showOutputField}
                  />
                </>
              )}
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
              {!showOutputField && areaPath && (
                <MemoizedAreaPathRenderer
                  key={`area-path-${showOutputField}`}
                  areaPath={areaPath}
                />
              )}
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

type YScaleRendererProps = {
  customFontManager: ReturnType<typeof useSFProFonts>
  fontStyle: { fontFamily: string; fontSize: number }
  yScale: ScaleLinear<number, number>
  chartHeight: number
  chartWidth: number
  yAxisFormatter: (value: number) => string
}

function YScaleRenderer({
  customFontManager,
  fontStyle,
  yScale,
  chartHeight,
  chartWidth,
  yAxisFormatter
}: YScaleRendererProps) {
  if (!customFontManager) {
    return null
  }
  const font = matchFont(fontStyle, customFontManager)
  return (
    <>
      {yScale.ticks(4).map((tick) => {
        const yPosition = yScale(tick)
        if (yPosition > chartHeight) {
          return null
        }
        return (
          <Fragment key={tick.toString()}>
            <Line
              p1={vec(0, yPosition)}
              p2={vec(chartWidth, yPosition)}
              color="#FFFFFF29"
              style="stroke"
              strokeWidth={1}
            >
              <DashPathEffect intervals={[2, 2]} phase={0} />
            </Line>
            <Text
              x={-30}
              y={yPosition + 6}
              text={yAxisFormatter(tick)}
              font={font}
              color="white"
            />
          </Fragment>
        )
      })}
    </>
  )
}

const MemoizedYScaleRenderer = memo(YScaleRenderer)

type XScaleRendererProps = {
  customFontManager: ReturnType<typeof useSFProFonts>
  fontStyle: { fontFamily: string; fontSize: number }
  showTransactionInfo: boolean
  txXAxisLabels: {
    textColor: string
    x: number
    index: number
    amountString: string
    type: 'send' | 'receive'
    numberOfOutput: number
    numberOfInput: number
    hasChange: boolean
    fee?: number
    confirmations?: string
    label?: string
  }[]
  chartHeight: number
  zeroPadding: boolean
}

function formatAmountWithLeadingZeros(
  amountString: string,
  font: ReturnType<typeof matchFont>,
  baseColor = '#666666'
): { text: string; color: string; x: number }[] {
  if (!amountString) {
    return []
  }

  const parts = amountString.split(' | ')
  const segments: { text: string; color: string; x: number }[] = []
  let currentX = 0

  for (const [partIndex, part] of parts.entries()) {
    if (partIndex > 0) {
      segments.push({
        color: '#666666',
        text: ' | ',
        x: currentX
      })
      currentX += font.measureText(' | ').width
    }

    if (part.startsWith('Fee: ')) {
      const feePart = part.substring(5)
      segments.push({ color: '#666666', text: 'Fee: ', x: currentX })
      currentX += font.measureText('Fee: ').width

      const firstNonZeroIndex = feePart.search(/[1-9]/)
      if (firstNonZeroIndex === -1) {
        segments.push({ color: '#666666', text: feePart, x: currentX })
        currentX += font.measureText(feePart).width
      } else {
        if (firstNonZeroIndex > 0) {
          segments.push({
            color: '#666666',
            text: feePart.substring(0, firstNonZeroIndex),
            x: currentX
          })
          currentX += font.measureText(
            feePart.substring(0, firstNonZeroIndex)
          ).width
        }
        segments.push({
          color: '#999999',
          text: feePart.substring(firstNonZeroIndex),
          x: currentX
        })
        currentX += font.measureText(feePart.substring(firstNonZeroIndex)).width
      }
    } else {
      const sign = part.startsWith('+') || part.startsWith('-') ? part[0] : ''
      const numberPart = sign ? part.substring(1) : part

      if (sign) {
        segments.push({ color: baseColor, text: sign, x: currentX })
        currentX += font.measureText(sign).width
      }

      const firstNonZeroIndex = numberPart.search(/[1-9]/)
      if (firstNonZeroIndex === -1) {
        segments.push({
          color: hexToRgba(baseColor, 0.4),
          text: numberPart,
          x: currentX
        })
        currentX += font.measureText(numberPart).width
      } else {
        if (firstNonZeroIndex > 0) {
          segments.push({
            color: hexToRgba(baseColor, 0.4),
            text: numberPart.substring(0, firstNonZeroIndex),
            x: currentX
          })
          currentX += font.measureText(
            numberPart.substring(0, firstNonZeroIndex)
          ).width
        }
        segments.push({
          color: baseColor,
          text: numberPart.substring(firstNonZeroIndex),
          x: currentX
        })
        currentX += font.measureText(
          numberPart.substring(firstNonZeroIndex)
        ).width
      }
    }
  }

  return segments
}

function XScaleRenderer({
  customFontManager,
  fontStyle,
  showTransactionInfo,
  txXAxisLabels,
  chartHeight,
  zeroPadding
}: XScaleRendererProps) {
  if (!customFontManager || !showTransactionInfo || !txXAxisLabels?.length) {
    return null
  }
  const font = matchFont(fontStyle, customFontManager)
  return (
    <>
      {txXAxisLabels.map((t, index) => {
        const { x } = t
        return (
          <Fragment key={t.x + index.toString()}>
            <Group>
              <Line
                p1={vec(x, 0)}
                p2={vec(x, chartHeight)}
                color="#FFFFFF29"
                style="stroke"
              >
                <DashPathEffect intervals={[2, 2]} phase={0} />
              </Line>
              {t.textColor === 'transparent' ? (
                <Text
                  x={x}
                  y={chartHeight + 20}
                  text={(() => {
                    const parts: string[] = [
                      t.label ? `${t.label} #${t.index}` : `TX ${t.index}`
                    ]
                    if (t.confirmations) {
                      parts.push(t.confirmations)
                    }
                    return parts.join(' | ')
                  })()}
                  font={font}
                  color="transparent"
                />
              ) : (
                <Group>
                  <Text
                    x={x}
                    y={chartHeight + 20}
                    text={t.label ? `${t.label} #${t.index}` : `TX ${t.index}`}
                    font={font}
                    color="white"
                  />
                  {t.confirmations && (
                    <>
                      <Text
                        x={
                          x +
                          font.measureText(
                            t.label ? `${t.label} #${t.index}` : `TX ${t.index}`
                          ).width
                        }
                        y={chartHeight + 20}
                        text=" "
                        font={font}
                        color="#666666"
                      />
                      <Text
                        x={
                          x +
                          font.measureText(
                            `${t.label ? `${t.label} #${t.index}` : `TX ${t.index}`} | `
                          ).width
                        }
                        y={chartHeight + 20}
                        text={t.confirmations}
                        font={font}
                        color="#666666"
                      />
                    </>
                  )}
                </Group>
              )}
              {t.textColor === 'transparent' ? (
                <Text
                  x={x}
                  y={chartHeight + 30}
                  text={(() => {
                    const parts: string[] = [t.amountString]
                    if (t.type === 'send' && t.fee !== undefined) {
                      parts.push(`Fee: ${formatNumber(t.fee, 0, zeroPadding)}`)
                    }
                    return parts.join(' | ')
                  })()}
                  font={font}
                  color="transparent"
                />
              ) : (
                <Group>
                  {formatAmountWithLeadingZeros(
                    (() => {
                      const parts: string[] = [t.amountString]
                      if (t.type === 'send' && t.fee !== undefined) {
                        parts.push(
                          `Fee: ${formatNumber(t.fee, 0, zeroPadding)}`
                        )
                      }
                      return parts.join(' | ')
                    })(),
                    font,
                    t.type === 'receive' ? '#A7FFAF' : '#FF7171'
                  ).map((segment, segIndex) => (
                    <Text
                      key={segIndex}
                      x={x + segment.x}
                      y={chartHeight + 30}
                      text={segment.text}
                      font={font}
                      color={segment.color}
                    />
                  ))}
                </Group>
              )}
              <Text
                x={x}
                y={chartHeight + 40}
                text={`${t.numberOfInput} in / ${t.numberOfOutput} out${
                  t.hasChange ? ' + change' : ''
                }`}
                font={font}
                color={
                  t.textColor === 'transparent' ? 'transparent' : '#666666'
                }
              />
            </Group>
          </Fragment>
        )
      })}
    </>
  )
}

const MemoizedXScaleRenderer = memo(XScaleRenderer)

type XAxisRendererProps = {
  customFontManager: ReturnType<typeof useSFProFonts>
  fontStyle: { fontFamily: string; fontSize: number }
  xScale: ScaleTime<number, number>
  chartHeight: number
  showTransactionInfo: boolean
}

function XAxisRenderer({
  customFontManager,
  fontStyle,
  xScale,
  chartHeight,
  showTransactionInfo
}: XAxisRendererProps) {
  if (!customFontManager) {
    return null
  }
  const font = matchFont(fontStyle, customFontManager)
  const ticks = xScale.ticks(3)
  const tickData = ticks.map((tick, index) => {
    const currentDate = timeFormat('%b %d')(tick)
    const previousDate = index > 0 ? timeFormat('%b %d')(ticks[index - 1]) : ''
    const displayTime = previousDate === currentDate
    return { currentDate, displayTime, tick, x: xScale(tick) }
  })
  return (
    <>
      {tickData.map(({ tick, currentDate, displayTime, x }) => (
        <Group key={tick.getTime().toString()}>
          <Text
            x={x}
            y={chartHeight + (showTransactionInfo ? 60 : 20)}
            text={displayTime ? timeFormat('%b %d %H:%M')(tick) : currentDate}
            font={font}
            color="#777777"
          />
        </Group>
      ))}
    </>
  )
}

const MemoizedXAxisRenderer = memo(XAxisRenderer)

type AreaPathRendererProps = {
  areaPath: string | null
}

function AreaPathRenderer({ areaPath }: AreaPathRendererProps) {
  const path = useMemo(() => {
    if (areaPath === null) {
      return null
    }
    return Skia.Path.MakeFromSVGString(areaPath)
  }, [areaPath])

  if (path === null) {
    return null
  }
  const bounds = path.getBounds()
  const gradientStart = vec(0, bounds.y)
  const gradientEnd = vec(0, bounds.height + bounds.y)
  const paint = Skia.Paint()
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      gradientStart,
      gradientEnd,
      [Skia.Color('#FFFFFF88'), Skia.Color('#FFFFFF33')],
      [0, 1],
      TileMode.Clamp
    )
  )
  return <Path path={path} paint={paint} />
}

const MemoizedAreaPathRenderer = memo(AreaPathRenderer)

type UtxoRectRendererProps = {
  utxoRectangleData: {
    x1: number
    x2: number
    y1: number
    y2: number
    utxo: Utxo
    gradientType: number
  }[]
  showOutputField: boolean
}

function UtxoRectRenderer({
  utxoRectangleData,
  showOutputField
}: UtxoRectRendererProps) {
  if (!showOutputField) {
    return null
  }
  return (
    <>
      {utxoRectangleData.map((data, index) => (
        <Fragment key={getUtxoOutpoint(data.utxo) + index}>
          <Rect
            x={data.x1}
            y={data.y1}
            width={data.x2 - data.x1}
            height={data.y2 - data.y1}
            style="fill"
            strokeWidth={0.5}
          >
            <LinearGradient
              start={vec(0, data.y2)}
              end={vec(0, data.y1)}
              colors={['#FFFFFF99', '#FFFFFF55']}
            />
          </Rect>
          {(data.gradientType === -1 || data.gradientType === 2) && (
            <Rect
              x={data.x1}
              y={data.y1}
              width={data.x2 - data.x1}
              height={data.y2 - data.y1}
              style="fill"
              strokeWidth={0.5}
            >
              <LinearGradient
                start={vec(data.x1, data.y1)}
                end={vec(data.x2, data.y1)}
                colors={['#FFFFFF55', '#FFFFFF00', '#FFFFFF00']}
                positions={[0, 0.3, 1]}
              />
            </Rect>
          )}
          {(data.gradientType === 1 || data.gradientType === 2) && (
            <Rect
              x={data.x1}
              y={data.y1}
              width={data.x2 - data.x1}
              height={data.y2 - data.y1}
              style="fill"
              strokeWidth={0.5}
            >
              <LinearGradient
                start={vec(data.x1, data.y1)}
                end={vec(data.x2, data.y1)}
                colors={['#00000000', '#00000000', '#00000055']}
                positions={[0, 0.7, 1]}
              />
            </Rect>
          )}
        </Fragment>
      ))}
    </>
  )
}

const MemoizedUtxoRectRenderer = memo(UtxoRectRenderer)

type UtxoLabelRendererProps = {
  customFontManager: ReturnType<typeof useSFProFonts>
  fontStyle: { fontFamily: string; fontSize: number }
  utxoLabels: {
    x1: number
    x2: number
    y1: number
    y2: number
    utxo: Utxo
  }[]
  showOutputField: boolean
}

function UtxoLabelRenderer({
  customFontManager,
  fontStyle,
  utxoLabels,
  showOutputField
}: UtxoLabelRendererProps) {
  if (!customFontManager || !showOutputField) {
    return null
  }
  const font = matchFont(fontStyle, customFontManager)
  return (
    <>
      {utxoLabels.map((data, index) => {
        if (data.x2 - data.x1 >= 50 && data.y1 - data.y2 >= 10) {
          return (
            <Text
              key={getUtxoOutpoint(data.utxo) + index}
              x={data.x1 + 2}
              y={data.y2 + 10}
              text={`${data.utxo.txid.slice(0, 3)}...${data.utxo.txid.slice(-3)}:${data.utxo.vout}`}
              font={font}
              color="white"
            />
          )
        }
        return null
      })}
    </>
  )
}

const MemoizedUtxoLabelRenderer = memo(UtxoLabelRenderer)

type TransactionInfoRendererProps = {
  customFontManager: ReturnType<typeof useSFProFonts>
  fontStyle: { fontFamily: string; fontSize: number }
  txInfoLabels: {
    x: number
    y: number
    memo?: string
    amount?: number
    type: string
    boundBox?: Rectangle
    index: string
    id: string
  }[]
  labelParagraphs: Map<string, SkParagraph>
  showLabel: boolean
  showAmount: boolean
  zeroPadding: boolean
  labelRectRef: React.MutableRefObject<{ rect: Rectangle; id: string }[]>
}

function TransactionInfoRenderer({
  customFontManager,
  fontStyle,
  txInfoLabels,
  labelParagraphs,
  showLabel,
  showAmount,
  zeroPadding,
  labelRectRef
}: TransactionInfoRendererProps) {
  if (!customFontManager) {
    return null
  }
  const font = matchFont(fontStyle, customFontManager)
  labelRectRef.current = []
  return (
    <>
      {txInfoLabels.map((label) => {
        if (label.type === 'end') {
          return null
        }
        const text =
          (showLabel && label.memo!) ||
          (showAmount &&
            label.amount !== undefined &&
            `${label.amount >= 0 ? '+' : ''}${formatNumber(
              label.amount,
              0,
              zeroPadding
            )}`) ||
          ''

        const paragraph = labelParagraphs.get(label.index)
        const paragraphWidth = paragraph ? paragraph.getMinIntrinsicWidth() : 0
        const textWidth = paragraph
          ? paragraphWidth
          : font.measureText(text).width

        labelRectRef.current.push({
          id: label.id,
          rect: {
            bottom: label.y,
            left: label.type === 'receive' ? label.x - textWidth : label.x,
            right: label.type === 'receive' ? label.x : label.x + textWidth,
            top: label.y - 10
          }
        })

        if (paragraph) {
          const xPos = label.type === 'receive' ? label.x - textWidth : label.x
          const clampedX = Math.max(0, xPos)
          return (
            <Fragment key={label.id}>
              <Paragraph
                paragraph={paragraph}
                x={clampedX}
                y={label.y - 10}
                width={Math.max(paragraphWidth * 3, 200)}
              />
            </Fragment>
          )
        }

        const xPos = label.type === 'receive' ? label.x - textWidth : label.x
        const clampedX = Math.max(0, xPos)
        return (
          <Fragment key={label.id}>
            <Text
              x={clampedX}
              y={label.y}
              text={text}
              font={font}
              color={label.type === 'receive' ? '#A7FFAF' : '#FF7171'}
            />
          </Fragment>
        )
      })}
    </>
  )
}

const MemoizedTransactionInfoRenderer = memo(TransactionInfoRenderer)

type CursorRendererProps = {
  customFontManager: ReturnType<typeof useSFProFonts>
  fontStyle: { fontFamily: string; fontSize: number }
  cursorX: Date | undefined
  cursorY: number | undefined
  xScale: ScaleTime<number, number>
  chartHeight: number
  zeroPadding: boolean
}

function CursorRenderer({
  customFontManager,
  fontStyle,
  cursorX,
  cursorY,
  xScale,
  chartHeight,
  zeroPadding
}: CursorRendererProps) {
  if (!customFontManager || cursorX === undefined) {
    return null
  }
  const font = matchFont(fontStyle, customFontManager)
  const formattedAmount = formatNumber(cursorY ?? 0, 0, zeroPadding)
  const segments = formatAmountWithLeadingZeros(formattedAmount, font)

  return (
    <Group>
      <Line
        p1={vec(xScale(cursorX), 20)}
        p2={vec(xScale(cursorX), chartHeight)}
        color="white"
        style="stroke"
      >
        <DashPathEffect intervals={[10, 2]} phase={0} />
      </Line>
      {segments.map((segment, segIndex) => (
        <Text
          key={segIndex}
          x={xScale(cursorX) + segment.x}
          y={10}
          text={segment.text}
          font={font}
          color={segment.color}
        />
      ))}
    </Group>
  )
}

const MemoizedCursorRenderer = memo(CursorRenderer)

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
