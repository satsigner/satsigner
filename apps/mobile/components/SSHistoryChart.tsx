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
  useFonts,
  vec
} from '@shopify/react-native-skia'
import * as d3 from 'd3'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Fragment, memo, useCallback, useMemo, useRef, useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import { useChartSettingStore } from '@/store/chartSettings'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type Rectangle } from '@/types/ui/geometry'
import { isOverlapping } from '@/utils/geometry'
import { getUtxoOutpoint } from '@/utils/utxo'

type HistoryChartData = {
  memo: string
  date: Date
  balance: number
  amount: number
  type: 'send' | 'receive' | 'end'
  id: string
}

type SSHistoryChartProps = {
  transactions: Transaction[]
  utxos: Utxo[]
}

function SSHistoryChart({ transactions, utxos }: SSHistoryChartProps) {
  const router = useRouter()

  const [
    showLabel,
    showAmount,
    showTransactionInfo,
    showOutputField,
    lockZoomToXAxis
  ] = useChartSettingStore(
    useShallow((state) => [
      state.showLabel,
      state.showAmount,
      state.showTransactionInfo,
      state.showOutputField,
      state.lockZoomToXAxis
    ])
  )

  const { id } = useLocalSearchParams<AccountSearchParams>()
  const currentDate = useRef<Date>(new Date())
  const labelRectRef = useRef<{ rect: Rectangle; id: string }[]>([])

  const walletAddresses = useMemo(() => {
    const addresses = new Set<string>()
    const transactionsMap = new Map<string, Transaction>()
    utxos.forEach((val) => {
      addresses.add(val.addressTo ?? '')
    })
    transactions.forEach((t) => {
      transactionsMap.set(t.id, t)
    })
    transactions
      .filter((t) => t.type === 'send')
      .forEach((t) => {
        t.vin?.forEach((input) => {
          addresses.add(
            transactionsMap
              .get(input?.previousOutput?.txid ?? '')
              ?.vout?.at(input?.previousOutput?.vout ?? 0)?.address ?? ''
          )
        })
      })
    addresses.delete('')
    return addresses
  }, [transactions, utxos])

  const chartData: HistoryChartData[] = useMemo(() => {
    let sum = 0
    return transactions.map((transaction) => {
      const amount =
        transaction.type === 'receive'
          ? transaction?.received ?? 0
          : (transaction?.received ?? 0) - (transaction?.sent ?? 0)
      sum += amount
      return {
        memo: transaction.label ?? '',
        date: new Date(transaction?.timestamp ?? currentDate.current),
        type: transaction.type ?? 'receive',
        balance: sum,
        amount,
        id: transaction.id
      }
    })
  }, [transactions])

  const timeOffset =
    chartData.length > 0
      ? new Date(currentDate.current).setDate(
          currentDate.current.getDate() + 10
        ) - chartData[0].date.getTime()
      : 0
  const margin = { top: 30, right: 10, bottom: 80, left: 40 }
  const [containerSize, setContainersize] = useState({ width: 0, height: 0 })
  const prevScale = useRef<number>(1)
  const scaleRef = useRef<number>(1)
  const [cursorX, setCursorX] = useState<Date | undefined>(undefined)
  const [cursorY, setCursorY] = useState<number | undefined>(undefined)
  const [{ endDate, scale }, setLocationState] = useState<{
    endDate: Date
    scale: number
  }>({
    endDate: new Date(
      new Date(currentDate.current).setDate(currentDate.current.getDate() + 5)
    ),
    scale: 1
  })
  const endDateRef = useRef<Date>(
    new Date(
      new Date(currentDate.current).setDate(currentDate.current.getDate() + 5)
    )
  )
  const prevEndDate = useRef<Date>(new Date(currentDate.current))
  const [startY, setStartY] = useState<number>(0)
  const startYRef = useRef<number>(0)
  const prevStartY = useRef<number>(0)
  const gestureUpdateAnimationFrameRef = useRef<number | null>(null)
  const isGestureActiveRef = useRef<boolean>(false)

  const startDate = useMemo<Date>(() => {
    return new Date(endDate.getTime() - timeOffset / scale)
  }, [endDate, scale, timeOffset])

  const visibleTransactionsRange = useMemo(() => {
    if (transactions.length === 0) return { startIndex: 0, endIndex: 0 }
    const startIndex = transactions.findIndex(
      (t) => new Date(t.timestamp ?? 0) >= startDate
    )
    const endIndex = transactions.findIndex(
      (t) => new Date(t.timestamp ?? 0) > endDate
    )
    return {
      startIndex: startIndex === -1 ? 0 : startIndex,
      endIndex: endIndex === -1 ? transactions.length : endIndex
    }
  }, [transactions, startDate, endDate])

  const balanceHistory = useMemo(() => {
    const history = new Map<number, Map<string, Utxo>>()
    const pendingDeleteBalances = new Set<string>()
    transactions.forEach((t, index) => {
      const currentBalances = new Map<string, Utxo>()
      if (index > 0) {
        history
          .get(index - 1)!
          .forEach((value, key) => currentBalances.set(key, { ...value }))
      }
      if (t.type === 'receive') {
        t.vout.forEach((out, index) => {
          if (walletAddresses.has(out.address)) {
            const outName = t.id + '::' + index
            currentBalances.set(outName, {
              addressTo: out.address,
              value: out.value,
              vout: index,
              label: '',
              keychain: 'internal',
              txid: t.id
            })
          }
        })
      } else if (t.type === 'send') {
        t.vin?.forEach((input) => {
          const inputName =
            input.previousOutput.txid + '::' + input.previousOutput.vout
          if (currentBalances.has(inputName)) {
            currentBalances.delete(inputName)
          } else {
            pendingDeleteBalances.add(inputName)
          }
        })
        t.vout?.forEach((out, index) => {
          if (walletAddresses.has(out.address)) {
            const outName = t.id + '::' + index
            currentBalances.set(outName, {
              addressTo: out.address,
              value: out.value,
              vout: index,
              txid: t.id,
              keychain: 'internal',
              label: ''
            })
          }
        })
      }
      history.set(index, currentBalances)
    })
    pendingDeleteBalances.forEach((value) => {
      Array.from(history.entries()).forEach(([, historyBalance]) => {
        if (historyBalance.has(value)) {
          historyBalance.delete(value)
        }
      })
      pendingDeleteBalances.delete(value)
    })
    return history
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddresses])

  const [maxBalance, validChartData] = useMemo(() => {
    const startBalance =
      chartData.findLast((d) => d.date < startDate)?.balance ?? 0
    const validData = chartData.filter(
      (d) => d.date >= startDate && d.date <= endDate
    )
    const maxBalance = Math.max(
      ...(lockZoomToXAxis
        ? validData.map((d) => d.balance)
        : chartData.map((d) => d.balance)),
      startBalance,
      1
    )
    validData.unshift({
      date: startDate,
      amount: 0,
      balance: startBalance,
      memo: '',
      type: 'end',
      id: ''
    })
    if (endDate.getTime() <= currentDate.current.getTime()) {
      validData.push({
        date: endDate,
        amount: 0,
        balance: validData[validData.length - 1]?.balance ?? 0,
        memo: '',
        type: 'end',
        id: ''
      })
    } else {
      validData.push({
        date: currentDate.current,
        amount: 0,
        balance: validData[validData.length - 1]?.balance ?? 0,
        memo: '',
        type: 'end',
        id: ''
      })
    }
    return [maxBalance, validData]
  }, [chartData, lockZoomToXAxis, startDate, endDate])

  const chartWidth = containerSize.width - margin.left - margin.right
  const chartHeight = containerSize.height - margin.top - margin.bottom

  const xScale = useMemo(() => {
    return d3.scaleTime().domain([startDate, endDate]).range([0, chartWidth])
  }, [chartWidth, endDate, startDate])

  const yScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain([
        lockZoomToXAxis ? 0 : startY,
        lockZoomToXAxis ? maxBalance * 1.2 : startY + (maxBalance * 1.2) / scale
      ])
      .range([chartHeight, 0])
  }, [chartHeight, lockZoomToXAxis, maxBalance, scale, startY])

  const utxoRectangleData: {
    x1: number
    x2: number
    y1: number
    y2: number
    utxo: Utxo
    gradientType: number
  }[] = useMemo(() => {
    return Array.from(balanceHistory.entries())
      .flatMap(([index, balances]) => {
        const x1 = xScale(
          new Date(transactions.at(index)?.timestamp ?? currentDate.current)
        )
        const x2 = xScale(
          index === transactions.length - 1
            ? currentDate.current
            : new Date(
                transactions.at(index + 1)?.timestamp ?? currentDate.current
              )
        )
        if (x2 < 0 && x1 >= chartWidth) {
          return []
        }
        let totalBalance = 0
        return Array.from(balances.entries()).map(([, utxo]) => {
          const y1 = yScale(totalBalance)
          const y2 = yScale(totalBalance + utxo.value)
          let gradientType = 0
          totalBalance += utxo.value
          if (
            transactions.at(index + 1) !== undefined &&
            transactions.at(index + 1)?.type === 'send'
          ) {
            const result = transactions
              .at(index + 1)
              ?.vin!.find(
                (input) =>
                  input.previousOutput.txid === utxo.txid &&
                  input.previousOutput.vout === utxo.vout
              )
            if (result !== undefined) {
              gradientType = 1
            }
          }
          if (utxo.txid === transactions.at(index)?.id) {
            if (gradientType === 1) {
              gradientType = 2
            } else {
              gradientType = -1
            }
          }
          return {
            x1,
            x2,
            y1,
            y2,
            utxo,
            gradientType
          }
        })
      })
      .filter((v) => v !== undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceHistory, xScale, yScale])

  const utxoLabels: {
    x1: number
    x2: number
    y1: number
    y2: number
    utxo: Utxo
  }[] = useMemo(() => {
    const result: {
      x1: number
      x2: number
      y1: number
      y2: number
      utxo: Utxo
    }[] = []
    Array.from(balanceHistory.entries()).forEach(([index, balances]) => {
      const x1 = xScale(
        new Date(transactions.at(index)?.timestamp ?? currentDate.current)
      )
      const x2 = xScale(
        index === transactions.length - 1
          ? currentDate.current
          : new Date(
              transactions.at(index + 1)?.timestamp ?? currentDate.current
            )
      )
      if (x2 < 0 && x1 >= chartWidth) {
        return
      }
      let totalBalance = 0
      Array.from(balances.entries()).forEach(([, utxo]) => {
        const y1 = yScale(totalBalance)
        const y2 = yScale(totalBalance + utxo.value)
        totalBalance += utxo.value
        if (utxo.txid === transactions.at(index)?.id) {
          result.push({
            x1,
            x2,
            y1,
            y2,
            utxo
          })
        }
      })
    })
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceHistory, xScale, yScale])

  const xScaleTransactions = useMemo(() => {
    return transactions
      .map((t, index) => ({ ...t, index }))
      .filter(
        (t) =>
          new Date(t?.timestamp ?? 0) >= startDate &&
          new Date(t?.timestamp ?? 0) <= endDate
      )
  }, [endDate, startDate, transactions])

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
          if (index >= 0) {
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

  const combinedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    pressGesture,
    longPressGesture
  )

  const lineGenerator = useMemo(() => {
    return d3
      .line<HistoryChartData>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.balance))
      .curve(d3.curveStepAfter)
  }, [xScale, yScale])

  const areaGenerator = useMemo(() => {
    return d3
      .area<HistoryChartData>()
      .x((d) => xScale(d.date))
      .y0(chartHeight * scale)
      .y1((d) => yScale(d.balance))
      .curve(d3.curveStepAfter)
  }, [chartHeight, scale, xScale, yScale])

  const linePath = lineGenerator(validChartData)
  const areaPath = areaGenerator(validChartData)

  const yAxisFormatter = useMemo(() => {
    return d3.format('.3s')
  }, [])
  const cursorFormatter = useMemo(() => {
    return d3.format(',d')
  }, [])
  const numberCommaFormatter = useMemo(() => {
    return d3.format(',')
  }, [])

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainersize({ width, height })
  }, [])

  const txXAxisLabels = useMemo<
    {
      textColor: string
      x: number
      index: number
      amountString: string
      type: 'send' | 'receive'
      numberOfOutput: number
      numberOfInput: number
    }[]
  >(() => {
    if (!showTransactionInfo) {
      return []
    }
    const length = xScaleTransactions.length
    const xAxisLabels = xScaleTransactions.map((t) => {
      const amount = t.type === 'receive' ? t.received : t.received - t.sent
      let numberOfOutput: number = 0
      let numberOfInput: number = 0
      if (t.type === 'receive') {
        numberOfOutput =
          t.vout.filter((out) => walletAddresses.has(out.address)).length ?? 0
      } else if (t.type === 'send') {
        numberOfInput = t.vin?.length ?? 0
      }
      return {
        x: xScale(new Date(t.timestamp ?? new Date())),
        index: t.index,
        textColor: '',
        amountString: `${amount >= 0 ? '+' : ''}${numberCommaFormatter(
          amount
        )}`,
        type: t.type,
        numberOfOutput,
        numberOfInput
      }
    })
    const boundaryBoxes: { [key: string]: Rectangle } = {}
    xAxisLabels.forEach((t) => {
      boundaryBoxes[t.index] = {
        left: t.x,
        right: 40 + t.x,
        top: chartHeight,
        bottom: chartHeight + 30,
        width: 40,
        height: 30
      }
    })
    const visible: { [key: string]: boolean } = {}
    for (let i = 0; i < length; i++) {
      visible[xScaleTransactions[i].index] = true
    }
    for (let i = 0; i < length - 1; i++) {
      if (
        boundaryBoxes[xScaleTransactions[i].index] !== undefined &&
        boundaryBoxes[xScaleTransactions[i + 1].index] !== undefined &&
        isOverlapping(
          boundaryBoxes[xScaleTransactions[i].index],
          boundaryBoxes[xScaleTransactions[i + 1].index]
        )
      ) {
        visible[xScaleTransactions[i].index] = false
      }
    }
    const result = xAxisLabels.map((x) => {
      return {
        ...x,
        textColor: visible[x.index] ? 'white' : 'transparent'
      }
    })
    return result
  }, [
    walletAddresses,
    xScaleTransactions,
    xScale,
    showTransactionInfo,
    chartHeight,
    numberCommaFormatter
  ])

  const txInfoLabels = useMemo<
    {
      x: number
      y: number
      memo?: string
      amount?: number
      type: string
      boundBox?: Rectangle
      index: string
      id: string
    }[]
  >(() => {
    if (!showAmount && !showLabel) {
      return []
    }
    const initialLabels: {
      x: number
      y: number
      memo?: string
      amount?: number
      type: string
      boundBox?: Rectangle
      index: string
      id: string
    }[] = []

    validChartData.forEach((d) => {
      if (d.type === 'end') return
      const x = Math.round(xScale(d.date) + (d.type === 'receive' ? -5 : +5))
      const y = Math.round(yScale(d.balance) - 5)
      if (x < 0 || x > chartWidth || y < 0 || y > chartHeight) {
        return
      }
      if (showLabel && d.memo) {
        const index = d.date.getTime().toString() + d.balance.toString() + 'L'
        const width = 40
        const height = 10
        const left = Math.round(d.type === 'receive' ? x - width : x)
        const right = Math.round(d.type === 'receive' ? x : x + width)
        const bottom = y
        const top = y - height
        initialLabels.push({
          x,
          y: y + (showAmount ? -15 : 0),
          memo: d.memo,
          type: d.type,
          boundBox: {
            left,
            right,
            top: top + (showAmount ? -15 : 0),
            bottom: bottom + (showAmount ? -15 : 0),
            width,
            height
          },
          index,
          id: d.id
        })
      }
      if (showAmount) {
        const index = d.date.getTime().toString() + d.balance.toString() + 'A'
        const width = 40
        const height = 10
        const left = Math.round(d.type === 'receive' ? x - width : x)
        const right = Math.round(d.type === 'receive' ? x : x + width)
        const bottom = y
        const top = y - height
        initialLabels.push({
          x,
          y,
          amount: d.amount,
          type: d.type,
          boundBox: {
            left,
            right,
            top,
            bottom,
            width,
            height
          },
          index,
          id: d.id
        })
      }
    })

    for (let i = 0; i < initialLabels.length - 1; i++) {
      const boundBoxA = initialLabels[i].boundBox
      if (!boundBoxA) continue
      for (let j = i + 1; j < initialLabels.length; j++) {
        const boundBoxB = initialLabels[j].boundBox
        if (boundBoxB && isOverlapping(boundBoxA, boundBoxB)) {
          initialLabels[j].y -= 30
          const labelBoundBox = initialLabels[j].boundBox
          if (labelBoundBox) {
            labelBoundBox.top -= 30
            labelBoundBox.bottom -= 30
          }
        }
      }
    }
    return initialLabels
  }, [
    showAmount,
    showLabel,
    validChartData,
    xScale,
    yScale,
    chartWidth,
    chartHeight
  ])

  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })
  const fontStyle = {
    fontFamily: 'SF Pro Text',
    fontSize: 10
  } as const

  const labelParagraphs = useMemo(() => {
    if (!customFontManager) return new Map<string, SkParagraph>()
    const paragraphs = new Map<string, SkParagraph>()

    txInfoLabels.forEach((label) => {
      if (label.type === 'end') return
      const x = label.x
      if (x < 0 || x > chartWidth) return
      const text =
        (showLabel && label.memo!) ||
        (showAmount && numberCommaFormatter(label.amount!)) ||
        ''

      const para = Skia.ParagraphBuilder.Make(
        {
          maxLines: 1,
          textAlign: TextAlign.Left
        },
        customFontManager
      )
        .pushStyle({
          color: Skia.Color(label.type === 'receive' ? '#A7FFAF' : '#FF7171'),
          fontFamilies: ['SF Pro Text'],
          fontSize: 10
        })
        .addText(text)
        .pop()
        .build()

      para.layout(1000)
      paragraphs.set(label.index, para)
    })

    return paragraphs
  }, [
    txInfoLabels,
    customFontManager,
    showLabel,
    showAmount,
    numberCommaFormatter,
    chartWidth
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
            width: containerSize.width,
            height: containerSize.height,
            flex: 1
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
                numberCommaFormatter={numberCommaFormatter}
                labelRectRef={labelRectRef}
              />
              <Path
                path={linePath ?? ''}
                color="white"
                strokeWidth={2}
                style="stroke"
              />
              {!showOutputField && (
                <MemoizedAreaPathRenderer areaPath={areaPath} />
              )}
              <MemoizedCursorRenderer
                customFontManager={customFontManager}
                fontStyle={fontStyle}
                cursorX={cursorX}
                cursorY={cursorY}
                xScale={xScale}
                chartHeight={chartHeight}
                cursorFormatter={cursorFormatter}
              />
            </Group>
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  )
}

type YScaleRendererProps = {
  customFontManager: ReturnType<typeof useFonts>
  fontStyle: { fontFamily: string; fontSize: number }
  yScale: d3.ScaleLinear<number, number>
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
        if (yPosition > chartHeight) return null
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
  customFontManager: ReturnType<typeof useFonts>
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
  }[]
  chartHeight: number
}

function XScaleRenderer({
  customFontManager,
  fontStyle,
  showTransactionInfo,
  txXAxisLabels,
  chartHeight
}: XScaleRendererProps) {
  if (!customFontManager || !showTransactionInfo || !txXAxisLabels?.length) {
    return null
  }
  const font = matchFont(fontStyle, customFontManager)
  return (
    <>
      {txXAxisLabels.map((t, index) => {
        const x = t.x
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
              <Text
                x={x}
                y={chartHeight + 10}
                text={`TX ${t.index}`}
                font={font}
                color={t.textColor}
              />
              <Text
                x={x}
                y={chartHeight + 20}
                text={t.amountString}
                font={font}
                color={t.textColor}
              />
              {t.type === 'receive' && (
                <Text
                  x={x}
                  y={chartHeight + 30}
                  text={`${t.numberOfOutput} Output`}
                  font={font}
                  color={t.textColor}
                />
              )}
              {t.type === 'send' && (
                <>
                  <Text
                    x={x}
                    y={chartHeight + 30}
                    text={`${t.numberOfInput} Input`}
                    font={font}
                    color={t.textColor}
                  />
                  <Text
                    x={x}
                    y={chartHeight + 40}
                    text="+ change"
                    font={font}
                    color={t.textColor}
                  />
                </>
              )}
            </Group>
          </Fragment>
        )
      })}
    </>
  )
}

const MemoizedXScaleRenderer = memo(XScaleRenderer)

type XAxisRendererProps = {
  customFontManager: ReturnType<typeof useFonts>
  fontStyle: { fontFamily: string; fontSize: number }
  xScale: d3.ScaleTime<number, number>
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
  let previousDate = ''
  return (
    <>
      {xScale.ticks(3).map((tick) => {
        const currentDate = d3.timeFormat('%b %d')(tick)
        const displayTime = previousDate === currentDate
        previousDate = currentDate
        const x = xScale(tick)
        return (
          <Group key={tick.getTime().toString()}>
            <Text
              x={x}
              y={chartHeight + (showTransactionInfo ? 50 : 20)}
              text={
                displayTime ? d3.timeFormat('%b %d %H:%M')(tick) : currentDate
              }
              font={font}
              color="#777777"
            />
          </Group>
        )
      })}
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
      {utxoRectangleData.map((data, index) => {
        return (
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
        )
      })}
    </>
  )
}

const MemoizedUtxoRectRenderer = memo(UtxoRectRenderer)

type UtxoLabelRendererProps = {
  customFontManager: ReturnType<typeof useFonts>
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
  customFontManager: ReturnType<typeof useFonts>
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
  numberCommaFormatter: (value: number) => string
  labelRectRef: React.MutableRefObject<{ rect: Rectangle; id: string }[]>
}

function TransactionInfoRenderer({
  customFontManager,
  fontStyle,
  txInfoLabels,
  labelParagraphs,
  showLabel,
  showAmount,
  numberCommaFormatter,
  labelRectRef
}: TransactionInfoRendererProps) {
  if (!customFontManager) {
    return null
  }
  const font = matchFont(fontStyle, customFontManager)
  labelRectRef.current = []
  return (
    <>
      {txInfoLabels.map((label, index) => {
        if (label.type === 'end') {
          return null
        }
        const text =
          (showLabel && label.memo!) ||
          (showAmount && numberCommaFormatter(label.amount!)) ||
          ''

        const paragraph = labelParagraphs.get(label.index)
        const textWidth = paragraph
          ? Math.max(
              paragraph.getMinIntrinsicWidth(),
              font.measureText(text).width
            )
          : font.measureText(text).width

        labelRectRef.current.push({
          rect: {
            left: label.type === 'receive' ? label.x - textWidth : label.x,
            right: label.type === 'receive' ? label.x : label.x + textWidth,
            bottom: label.y,
            top: label.y - 10
          },
          id: label.id
        })

        if (paragraph) {
          const xPos = label.type === 'receive' ? label.x - textWidth : label.x
          const clampedX = Math.max(0, xPos)
          return (
            <Fragment key={index}>
              <Paragraph
                paragraph={paragraph}
                x={clampedX}
                y={label.y - 10}
                width={textWidth}
              />
            </Fragment>
          )
        }

        const xPos = label.type === 'receive' ? label.x - textWidth : label.x
        const clampedX = Math.max(0, xPos)
        return (
          <Fragment key={index}>
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
  customFontManager: ReturnType<typeof useFonts>
  fontStyle: { fontFamily: string; fontSize: number }
  cursorX: Date | undefined
  cursorY: number | undefined
  xScale: d3.ScaleTime<number, number>
  chartHeight: number
  cursorFormatter: (value: number) => string
}

function CursorRenderer({
  customFontManager,
  fontStyle,
  cursorX,
  cursorY,
  xScale,
  chartHeight,
  cursorFormatter
}: CursorRendererProps) {
  if (!customFontManager || cursorX === undefined) {
    return null
  }
  const font = matchFont(fontStyle, customFontManager)
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
      <Text
        x={xScale(cursorX)}
        y={10}
        text={cursorFormatter(cursorY ?? 0)}
        font={font}
        color="white"
      />
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

export default memo(SSHistoryChart, (prevProps, nextProps) => {
  return (
    prevProps.transactions === nextProps.transactions &&
    prevProps.utxos === nextProps.utxos
  )
})
