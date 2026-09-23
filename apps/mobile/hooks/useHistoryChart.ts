import { Skia, type SkParagraph, TextAlign } from '@shopify/react-native-skia'
import { type ScaleTime } from 'd3-scale'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  type MutableRefObject,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react'
import { type LayoutChangeEvent } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'

import { useSFProFonts } from '@/hooks/useSFProFonts'
import { Colors } from '@/styles'
import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type Rectangle } from '@/types/ui/geometry'
import {
  formatFiatPrice,
  formatNumber,
  formatPercentualChange
} from '@/utils/format'
import {
  type HistoryChartData,
  hexToRgba,
  type TxInfoLabel,
  type UtxoRectangle
} from '@/utils/historyChart'

const DAYS_AHEAD = 5

function futureDate(from: Date, days: number): Date {
  return new Date(new Date(from).setDate(from.getDate() + days))
}

export function useHistoryChartViewport(currentDate: MutableRefObject<Date>) {
  const [containerSize, setContainersize] = useState({ height: 0, width: 0 })
  const [cursorX, setCursorX] = useState<Date | undefined>(undefined)
  const [cursorY, setCursorY] = useState<number | undefined>(undefined)
  const [startY, setStartY] = useState<number>(0)
  const [{ endDate, scale }, setLocationState] = useState<{
    endDate: Date
    scale: number
  }>({
    endDate: futureDate(currentDate.current, DAYS_AHEAD),
    scale: 1
  })

  const prevScale = useRef<number>(1)
  const scaleRef = useRef<number>(1)
  const endDateRef = useRef<Date>(futureDate(currentDate.current, DAYS_AHEAD))
  const prevEndDate = useRef<Date>(new Date(currentDate.current))
  const startYRef = useRef<number>(0)
  const prevStartY = useRef<number>(0)
  const gestureUpdateAnimationFrameRef = useRef<number | null>(null)
  const isGestureActiveRef = useRef<boolean>(false)

  const updateLocationState = useCallback(() => {
    if (gestureUpdateAnimationFrameRef.current) {
      cancelAnimationFrame(gestureUpdateAnimationFrameRef.current)
    }
    gestureUpdateAnimationFrameRef.current = requestAnimationFrame(() => {
      setLocationState((prev) => ({
        ...prev,
        endDate: endDateRef.current,
        scale: scaleRef.current
      }))
      gestureUpdateAnimationFrameRef.current = null
    })
  }, [])

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainersize({ height, width })
  }, [])

  return {
    containerSize,
    cursorX,
    cursorY,
    endDate,
    endDateRef,
    gestureUpdateAnimationFrameRef,
    handleLayout,
    isGestureActiveRef,
    prevEndDate,
    prevScale,
    prevStartY,
    scale,
    scaleRef,
    setCursorX,
    setCursorY,
    setLocationState,
    setStartY,
    startY,
    startYRef,
    updateLocationState
  }
}

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
  showTransactionInfo
}: UseHistoryChartGesturesParams) {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const {
    endDate,
    endDateRef,
    gestureUpdateAnimationFrameRef,
    isGestureActiveRef,
    prevEndDate,
    prevScale,
    prevStartY,
    scale,
    scaleRef,
    setCursorX,
    setCursorY,
    setLocationState,
    setStartY,
    startY,
    startYRef,
    updateLocationState
  } = viewport

  const panGesture = Gesture.Pan()
    .minDistance(1)
    .maxPointers(1)
    .onStart(() => {
      isGestureActiveRef.current = true
      prevEndDate.current = endDate
      prevStartY.current = startY
    })
    .onUpdate((event) => {
      endDateRef.current = new Date(
        Math.max(
          Math.min(
            prevEndDate.current.getTime() -
              ((timeOffset / scale) * event.translationX) / chartWidth,
            new Date(
              currentDate.current.getTime() + timeOffset / scale
            ).getTime()
          ),
          new Date(transactions[0]?.timestamp ?? 0).getTime()
        )
      )
      if (!lockZoomToXAxis) {
        startYRef.current = Math.max(
          Math.min(
            prevStartY.current +
              (((maxBalance * 1.2) / scale) * event.translationY) / chartHeight,
            maxBalance * 1.2 - (maxBalance * 1.2) / scale
          ),
          0
        )
        setStartY(startYRef.current)
      }
      updateLocationState()
    })
    .onEnd(() => {
      isGestureActiveRef.current = false
      prevEndDate.current = endDate
      prevStartY.current = startY
      if (gestureUpdateAnimationFrameRef.current) {
        cancelAnimationFrame(gestureUpdateAnimationFrameRef.current)
        gestureUpdateAnimationFrameRef.current = null
      }
      setLocationState((prev) => ({
        ...prev,
        endDate: endDateRef.current
      }))
    })
    .runOnJS(true)

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      isGestureActiveRef.current = true
    })
    .onUpdate((event) => {
      const cScale = Math.max(prevScale.current * event.scale, 1)
      const middleDate =
        endDateRef.current.getTime() - timeOffset / scaleRef.current / 2
      endDateRef.current = new Date(middleDate + timeOffset / cScale / 2)
      scaleRef.current = cScale
      updateLocationState()
    })
    .onEnd(() => {
      isGestureActiveRef.current = false
      prevScale.current = scale
      if (gestureUpdateAnimationFrameRef.current) {
        cancelAnimationFrame(gestureUpdateAnimationFrameRef.current)
        gestureUpdateAnimationFrameRef.current = null
      }
      setLocationState((prev) => ({
        ...prev,
        endDate: endDateRef.current,
        scale: scaleRef.current
      }))
    })
    .runOnJS(true)

  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onEnd((e, success) => {
      if (success) {
        const locationX = e.x
        const x = locationX - margin.left
        if (x >= 0 && x <= chartWidth) {
          const selectedDate = xScale.invert(x)
          setCursorX(selectedDate)
          const index = validChartData.findLastIndex(
            (d) => d.date <= selectedDate
          )
          if (index !== -1) {
            setCursorY(validChartData[index].balance)
          }
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
            router.navigate(
              `/signer/bitcoin/account/${id}/transaction/${tappedRect.utxo.txid}/utxo/${tappedRect.utxo.vout}`
            )
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
            router.navigate(
              `/signer/bitcoin/account/${id}/transaction/${tapLabelRect.id}`
            )
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

const LABEL_FONT = ['SF Pro Text']
const LABEL_BASE_FONT_SIZE = 10
const LABEL_FIAT_FONT_SIZE = 8

type UseHistoryChartLabelsParams = {
  customFontManager: ReturnType<typeof useSFProFonts>
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
}
