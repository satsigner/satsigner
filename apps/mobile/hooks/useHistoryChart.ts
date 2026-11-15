import { Skia, type SkParagraph, TextAlign } from '@shopify/react-native-skia'
import { type ScaleTime } from 'd3-scale'
import { type MutableRefObject, useMemo, useState } from 'react'
import { type LayoutChangeEvent } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useGeistFonts } from '@/hooks/useGeistFonts'
import { Colors, Typography } from '@/styles'
import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import { type Rectangle } from '@/types/ui/geometry'
import {
  type HistoryChartData,
  type TxInfoLabel,
  type UtxoRectangle
} from '@/types/ui/historyChart'
import { futureDate } from '@/utils/date'
import {
  formatFiatPrice,
  formatNumber,
  formatPercentualChange
} from '@/utils/format'
import { hexToRgba } from '@/utils/historyChart'
import {
  type HistoryChartViewportState,
  panViewport,
  pinchViewport
} from '@/utils/historyChartViewport'

const DAYS_AHEAD = 5
const LABEL_FONT = [Typography.geistSkiaFamily]
const LABEL_BASE_FONT_SIZE = 10
const LABEL_FIAT_FONT_SIZE = 8

type HistoryChartViewport = ReturnType<typeof useHistoryChartViewport>

type UseHistoryChartGesturesParams = {
  viewport: HistoryChartViewport
  currentDate: MutableRefObject<Date>
  labelRectRef: MutableRefObject<{ rect: Rectangle; id: string }[]>
  transactions: Transaction[]
  timeOffset: number
  chartWidth: number
  chartHeight: number
  maxBalance: number
  lockZoomToXAxis: boolean
  xScale: ScaleTime<number, number>
  validChartData: HistoryChartData[]
  utxoRectangleData: UtxoRectangle[]
  margin: { bottom: number; left: number; right: number; top: number }
  showOutputField: boolean
  showTransactionInfo: boolean
  onOpenUtxo: (txid: string, vout: number) => void
  onOpenTransaction: (txid: string) => void
}

type UseHistoryChartLabelsParams = {
  customFontManager: ReturnType<typeof useGeistFonts>
  txInfoLabels: TxInfoLabel[]
  transactionsMap: Map<string, Transaction>
  chartWidth: number
  zeroPadding: boolean
  showLabel: boolean
  showAmount: boolean
  showFiatOnChart: boolean
  showFiatAtTxTime: boolean
  showFiatPercentageChange: boolean
  showHistoricalFiat: boolean
  effectiveBtcPrice: number
  fiatCurrency: Currency
}

export function useHistoryChartViewport(currentDate: MutableRefObject<Date>) {
  const [containerSize, setContainersize] = useState({ height: 0, width: 0 })
  const [cursorX, setCursorX] = useState<Date | undefined>(undefined)
  const [cursorY, setCursorY] = useState<number | undefined>(undefined)
  const [rendered, setRendered] = useState<HistoryChartViewportState>(() => ({
    endMs: futureDate(currentDate.current, DAYS_AHEAD).getTime(),
    scale: 1,
    startY: 0
  }))

  const live = useSharedValue(rendered)
  const gestureOrigin = useSharedValue(rendered)

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout
    setContainersize({ height, width })
  }

  return {
    containerSize,
    cursorX,
    cursorY,
    endDate: new Date(rendered.endMs),
    gestureOrigin,
    handleLayout,
    live,
    rendered,
    scale: rendered.scale,
    setCursorX,
    setCursorY,
    setRendered,
    startY: rendered.startY
  }
}

export function useHistoryChartGestures({
  viewport,
  currentDate,
  labelRectRef,
  transactions,
  timeOffset,
  chartWidth,
  chartHeight,
  maxBalance,
  lockZoomToXAxis,
  xScale,
  validChartData,
  utxoRectangleData,
  margin,
  showOutputField,
  showTransactionInfo,
  onOpenUtxo,
  onOpenTransaction
}: UseHistoryChartGesturesParams) {
  const { gestureOrigin, live, setCursorX, setCursorY, setRendered } = viewport
  const nowMs = currentDate.current.getTime()
  const firstTxMs = new Date(transactions[0]?.timestamp ?? 0).getTime()

  const panGesture = Gesture.Pan()
    .minDistance(1)
    .maxPointers(1)
    .onStart(() => {
      gestureOrigin.value = live.value
    })
    .onUpdate((event) => {
      live.value = panViewport({
        chartHeight,
        chartWidth,
        firstTxMs,
        live: live.value,
        lockZoomToXAxis,
        maxBalance,
        nowMs,
        origin: gestureOrigin.value,
        timeOffset,
        translationX: event.translationX,
        translationY: event.translationY
      })
    })
    .onEnd(() => {
      scheduleOnRN(setRendered, live.value)
    })

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      gestureOrigin.value = live.value
    })
    .onUpdate((event) => {
      live.value = pinchViewport({
        live: live.value,
        maxBalance,
        originScale: gestureOrigin.value.scale,
        pinchScale: event.scale,
        timeOffset
      })
    })
    .onEnd(() => {
      scheduleOnRN(setRendered, live.value)
    })

  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onEnd((e, success) => {
      if (success) {
        const locationX = e.x
        const x = locationX - margin.left
        if (x >= 0 && x <= chartWidth) {
          const selectedDate = xScale.invert(x)
          const index = validChartData.findLastIndex(
            (d) => d.date <= selectedDate
          )
          // The cursor date and balance move together; before the first
          // point the balance was zero, not the previous press's value.
          setCursorX(selectedDate)
          setCursorY(index === -1 ? 0 : validChartData[index].balance)
        }
      }
    })
    .runOnJS(true)

  const pressGesture = Gesture.Tap()
    .maxDuration(100)
    .onEnd((e, success) => {
      if (success) {
        const locationX = e.x
        const locationY = e.y
        const x = locationX - margin.left
        const y = locationY - margin.top
        if (x >= 0 && x <= chartWidth && y >= 0 && y <= chartHeight) {
          const tappedRect = utxoRectangleData.find(
            (value) =>
              x >= value.x1 && x <= value.x2 && y >= value.y2 && y <= value.y1
          )
          if (tappedRect !== undefined && showOutputField) {
            onOpenUtxo(tappedRect.utxo.txid, tappedRect.utxo.vout)
            return
          }
          const tapLabelRect = labelRectRef.current.find(
            ({ rect }) =>
              x >= rect.left &&
              x <= rect.right &&
              y <= rect.bottom &&
              y >= rect.top
          )
          if (tapLabelRect !== undefined && showTransactionInfo) {
            onOpenTransaction(tapLabelRect.id)
          }
        }
      }
    })
    .runOnJS(true)

  return Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    pressGesture,
    longPressGesture
  )
}

// Builds the Skia paragraph objects drawn as transaction-info labels. Kept as a
// hook because it depends on the Skia font manager and must re-run when the
// chart's fiat/label settings change.
export function useHistoryChartLabels({
  customFontManager,
  txInfoLabels,
  transactionsMap,
  chartWidth,
  zeroPadding,
  showLabel,
  showAmount,
  showFiatOnChart,
  showFiatAtTxTime,
  showFiatPercentageChange,
  showHistoricalFiat,
  effectiveBtcPrice,
  fiatCurrency
}: UseHistoryChartLabelsParams) {
  return useMemo(() => {
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
        fontFamilies: LABEL_FONT,
        fontSize: LABEL_BASE_FONT_SIZE
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
        const numberPart = sign ? amountString.slice(1) : amountString

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
          const leadingZeros = numberPart.slice(0, firstNonZeroIndex)
          const significantDigits = numberPart.slice(firstNonZeroIndex)
          if (leadingZeros.length > 0) {
            const baseColorRgb = baseColor.match(
              /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i
            )
            const opacityColor = baseColorRgb
              ? Skia.Color(
                  `rgba(${Number.parseInt(baseColorRgb[1], 16)}, ${Number.parseInt(baseColorRgb[2], 16)}, ${Number.parseInt(baseColorRgb[3], 16)}, 0.4)`
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
            fontFamilies: LABEL_FONT,
            fontSize: LABEL_FIAT_FONT_SIZE
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
              fontFamilies: LABEL_FONT,
              fontSize: LABEL_FIAT_FONT_SIZE
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
            fontFamilies: LABEL_FONT,
            fontSize: LABEL_FIAT_FONT_SIZE
          })
          .addText(`\n ${percentageChangeText}`)
          .pop()
      }

      const builtPara = para.build()
      builtPara.layout(10_000)
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
}
