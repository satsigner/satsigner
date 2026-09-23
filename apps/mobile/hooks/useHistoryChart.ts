import { type ScaleTime } from 'd3-scale'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { type MutableRefObject, useCallback, useRef, useState } from 'react'
import { type LayoutChangeEvent } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'

import { type Transaction } from '@/types/models/Transaction'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type Rectangle } from '@/types/ui/geometry'
import { type HistoryChartData, type UtxoRectangle } from '@/utils/historyChart'

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
