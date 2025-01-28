import * as d3 from 'd3'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler'
import Svg, {
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Mask,
  Path,
  Rect,
  Stop,
  Text as SvgText,
  TSpan
} from 'react-native-svg'
import { useShallow } from 'zustand/react/shallow'

import { useChartSettingStore } from '@/store/chartSetting'
import { Transaction } from '@/types/models/Transaction'
import { Utxo } from '@/types/models/Utxo'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { getUtxoOutpoint } from '@/utils/utxo'

type BalanceChartData = {
  memo: string
  date: Date
  balance: number
  amount: number
  type: 'send' | 'receive' | 'end'
}

type Rectangle = {
  left: number
  right: number
  top: number
  bottom: number
  width?: number
  height?: number
}

export type SSBalanceChartProps = {
  transactions: Transaction[]
  utxos: Utxo[]
}

const isOverlapping = (rect1: Rectangle, rect2: Rectangle) => {
  if (rect1.right < rect2.left || rect2.right < rect1.left) return false
  if (rect1.bottom < rect2.top || rect2.bottom < rect1.top) return false
  return true
}

function SSBalanceChart({ transactions, utxos }: SSBalanceChartProps) {
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

  const [walletAddresses] = useMemo(() => {
    const addresses = new Set<string>()
    const transactinsMap = new Map<string, Transaction>()
    utxos.forEach((val) => {
      addresses.add(val.addressTo ?? '')
    })
    transactions.forEach((t) => {
      transactinsMap.set(t.id, t)
    })
    transactions
      .filter((t) => t.type === 'send')
      .forEach((t) => {
        t.vin?.forEach((input) => {
          addresses.add(
            transactinsMap
              .get(input?.previousOutput?.txid ?? '')
              ?.vout?.at(input?.previousOutput?.vout ?? 0)?.address ?? ''
          )
        })
      })
    addresses.delete('')
    return [addresses]
  }, [transactions, utxos])

  const balanceHistory = useMemo(() => {
    const history = new Map<number, Map<string, Utxo>>()
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
    return history
  }, [transactions, walletAddresses])

  const chartData: BalanceChartData[] = useMemo(() => {
    let sum = 0
    const result = transactions.map((transaction) => {
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
        amount
      }
    })
    return result
  }, [transactions])
  const timeOffset =
    new Date(currentDate.current).setDate(currentDate.current.getDate() + 10) -
    chartData[0].date.getTime()
  const margin = { top: 30, right: 0, bottom: 80, left: 40 }
  const [containerSize, setContainersize] = useState({ width: 0, height: 0 })

  const [scale, setScale] = useState<number>(1)
  const [cursorX, setCursorX] = useState<Date | undefined>(undefined)
  const [cursorY, setCursorY] = useState<number | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date>(
    new Date(
      new Date(currentDate.current).setDate(currentDate.current.getDate() + 5)
    )
  )
  const [prevEndDate, setPrevEndDate] = useState<Date>(
    new Date(currentDate.current)
  )
  const [startY, setStartY] = useState<number>(0)
  const [prevStartY, setPrevStartY] = useState<number>(0)

  const startDate = useMemo<Date>(() => {
    return new Date(endDate.getTime() - timeOffset / scale)
  }, [endDate, scale, timeOffset])

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
      type: 'end'
    })
    if (endDate.getTime() <= currentDate.current.getTime()) {
      validData.push({
        date: endDate,
        amount: 0,
        balance: validData[validData.length - 1]?.balance ?? 0,
        memo: '',
        type: 'end'
      })
    } else {
      validData.push({
        date: currentDate.current,
        amount: 0,
        balance: validData[validData.length - 1]?.balance ?? 0,
        memo: '',
        type: 'end'
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
        const x1 = xScale(new Date(transactions.at(index)?.timestamp!))
        const x2 = xScale(
          index === transactions.length - 1
            ? currentDate.current
            : new Date(transactions.at(index + 1)?.timestamp!)
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
  }, [balanceHistory, chartWidth, transactions, xScale, yScale])

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
      const x1 = xScale(new Date(transactions.at(index)?.timestamp!))
      const x2 = xScale(
        index === transactions.length - 1
          ? currentDate.current
          : new Date(transactions.at(index + 1)?.timestamp!)
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
  }, [balanceHistory, chartWidth, transactions, xScale, yScale])

  const xScaleTransactions = useMemo(() => {
    return transactions
      .map((t, index) => ({ ...t, index }))
      .filter(
        (t) =>
          new Date(t?.timestamp ?? 0) >= startDate &&
          new Date(t?.timestamp ?? 0) <= endDate
      )
  }, [endDate, startDate, transactions])

  const panGesture = Gesture.Pan()
    .minDistance(1)
    .maxPointers(1)
    .onStart(() => {
      setPrevEndDate(endDate)
      setPrevStartY(startY)
    })
    .onUpdate((event) => {
      setEndDate(
        new Date(
          Math.max(
            Math.min(
              prevEndDate.getTime() -
                ((timeOffset / scale) * event.translationX) / chartWidth,
              new Date(currentDate.current).setDate(
                new Date(currentDate.current).getDate() + 5
              )
            ),
            new Date(transactions[0].timestamp!).getTime()
          )
        )
      )
      if (!lockZoomToXAxis) {
        setStartY(
          Math.max(
            Math.min(
              prevStartY +
                (((maxBalance * 1.2) / scale) * event.translationY) /
                  chartHeight,
              maxBalance * 1.2 - (maxBalance * 1.2) / scale
            ),
            0
          )
        )
      }
    })
    .onEnd(() => {
      setPrevEndDate(endDate)
      setPrevStartY(startY)
    })
    .runOnJS(true)

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      setScale((prev) => Math.max(prev * event.scale, 1))
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
    .maxDuration(50)
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
          if (tappedRect !== undefined) {
            router.navigate(
              `/account/${id}/transaction/${tappedRect.utxo.txid}/utxo/${tappedRect.utxo.vout}`
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
      .line<BalanceChartData>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.balance))
      .curve(d3.curveStepAfter)
  }, [xScale, yScale])

  const areaGenerator = useMemo(() => {
    return d3
      .area<BalanceChartData>()
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

  const [txXBoundbox, setTxXBoundBox] = useState<{ [key: string]: Rectangle }>(
    {}
  )

  const handleXAxisLayout = (
    event: LayoutChangeEvent,
    index: number,
    x: number
  ) => {
    const rect: Rectangle = {
      left: Math.round(x),
      right: Math.round(x + event.nativeEvent.layout.width),
      top: Math.round(chartHeight),
      bottom: Math.round(chartHeight + event.nativeEvent.layout.height),
      width: Math.round(event.nativeEvent.layout.width),
      height: Math.round(event.nativeEvent.layout.height)
    }
    if (
      txXBoundbox[index] !== undefined &&
      txXBoundbox[index].left === rect.left &&
      txXBoundbox[index].bottom === rect.bottom &&
      txXBoundbox[index].top === rect.top &&
      txXBoundbox[index].right === rect.right
    ) {
      return
    }
    setTxXBoundBox((prev) => ({
      ...prev,
      [index]: rect
    }))
  }

  const [txXBoundVisible, setTxXBoundVisible] = useState<{
    [key: string]: boolean
  }>({})

  useEffect(() => {
    const length = xScaleTransactions.length
    for (let i = 0; i < length; i++) {
      if (txXBoundbox[xScaleTransactions[i].index] === undefined) {
        return
      }
    }
    const timerId = setTimeout(() => {
      const visible: { [key: string]: boolean } = {}
      let i = 0
      for (i = 0; i < length - 1; i++) {
        if (
          isOverlapping(
            txXBoundbox[xScaleTransactions[i].index],
            txXBoundbox[xScaleTransactions[i + 1].index]
          )
        ) {
          visible[xScaleTransactions[i].index] = false
        }
      }
      for (i = 0; i < length; i++) {
        if (visible[xScaleTransactions[i].index] === undefined) {
          visible[xScaleTransactions[i].index] = true
        }
      }
      setTxXBoundVisible(visible)
    }, 50)

    return () => clearTimeout(timerId)
  }, [txXBoundbox, xScaleTransactions])

  const txXAxisLabels = useMemo(() => {
    return xScaleTransactions.map((t) => {
      const amount = t.type === 'receive' ? t.received : t.received - t.sent
      let numberOfOutput: number = 0
      let numberOfInput: number = 0
      if (t.type === 'receive') {
        numberOfOutput =
          t.vout.filter((out) => walletAddresses.has(out.address)).length ?? 0
      } else if (t.type === 'send') {
        numberOfInput = t.vin?.length ?? 0
      }
      const textColor =
        txXBoundVisible[t.index] === true ? 'white' : 'transparent'

      return {
        x: xScale(new Date(t.timestamp ?? new Date())),
        index: t.index,
        textColor,
        amountString: `${amount >= 0 ? '+' : ''}${numberCommaFormatter(amount)}`,
        type: t.type,
        numberOfOutput,
        numberOfInput
      }
    })
  }, [
    numberCommaFormatter,
    txXBoundVisible,
    walletAddresses,
    xScale,
    xScaleTransactions
  ])

  const [txInfoLabels, setTxInfoLabels] = useState<
    {
      x: number
      y: number
      memo?: string
      amount?: number
      type: string
      boundBox?: Rectangle
    }[]
  >([])

  const [txInfoBoundBox, setTxInfoBoundBox] = useState<{
    [key: string]: Rectangle
  }>({})

  const handleTxInfoLayout = (
    event: LayoutChangeEvent,
    index: number,
    x: number,
    y: number,
    type: string
  ) => {
    const rect: Rectangle = {
      left: Math.min(
        Math.round(x),
        Math.round(
          x + (type === 'receive' ? -1 : 1) * event.nativeEvent.layout.width
        )
      ),
      right: Math.max(
        Math.round(x),
        Math.round(
          x + (type === 'receive' ? -1 : 1) * event.nativeEvent.layout.width
        )
      ),
      top: Math.min(
        Math.round(y),
        Math.round(y - event.nativeEvent.layout.height)
      ),
      bottom: Math.max(
        Math.round(y),
        Math.round(y - event.nativeEvent.layout.height)
      ),
      width: Math.round(event.nativeEvent.layout.width),
      height: Math.round(event.nativeEvent.layout.height)
    }
    if (
      txInfoBoundBox[index] !== undefined &&
      txInfoBoundBox[index].width === rect.width &&
      txInfoBoundBox[index].height === rect.height
    ) {
      return
    }
    setTxInfoBoundBox((prev) => ({
      ...prev,
      [index]: rect
    }))
  }

  useEffect(() => {
    const initialLabels: {
      x: number
      y: number
      memo?: string
      amount?: number
      type: string
      boundBox?: Rectangle
    }[] = []
    if (
      validChartData.findIndex(
        (d, index) => d.type !== 'end' && txInfoBoundBox[index] === undefined
      ) !== -1
    ) {
      validChartData.forEach((d) => {
        if (d.type === 'end') return
        const x = xScale(d.date) + (d.type === 'receive' ? -5 : +5)
        const y = yScale(d.balance) - 5
        if (showLabel && d.memo) {
          initialLabels.push({
            x,
            y: y + (showAmount ? -15 : 0),
            memo: d.memo,
            type: d.type
          })
        }
        if (showAmount) {
          initialLabels.push({
            x,
            y,
            amount: d.amount,
            type: d.type
          })
        }
      })
    } else {
      validChartData.forEach((d, index) => {
        if (d.type === 'end') return
        const x = Math.round(xScale(d.date) + (d.type === 'receive' ? -5 : +5))
        const y = Math.round(yScale(d.balance) - 5)
        const width = Math.round(txInfoBoundBox[index].width!)
        const height = Math.round(txInfoBoundBox[index].height!)
        const left = Math.round(d.type === 'receive' ? x - width : x)
        const right = Math.round(d.type === 'receive' ? x : x + width)
        const bottom = y
        const top = y - height
        if (showLabel && d.memo) {
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
            }
          })
        }
        if (showAmount) {
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
            }
          })
        }
      })
    }
    for (let i = 0; i < initialLabels.length - 1; i++) {
      const boundBoxA = initialLabels[i].boundBox
      for (let j = i + 1; j < initialLabels.length; j++) {
        const boundBoxB = initialLabels[j].boundBox
        if (boundBoxA !== undefined && boundBoxB !== undefined) {
          if (isOverlapping(boundBoxA!, boundBoxB!)) {
            initialLabels[j].y -= 20
            initialLabels[j].boundBox!.top -= 20
            initialLabels[j].boundBox!.bottom -= 20
          }
        }
      }
    }
    setTxInfoLabels(initialLabels)
  }, [showAmount, showLabel, txInfoBoundBox, validChartData, xScale, yScale])

  if (!containerSize.width || !containerSize.height) {
    return <View onLayout={handleLayout} style={styles.container} />
  }

  let previousDate: string = ''

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={combinedGesture}>
        <View style={styles.container} onLayout={handleLayout}>
          <Svg
            width={containerSize.width}
            height={containerSize.height}
            pointerEvents="box-none"
          >
            <G x={margin.left} y={margin.top}>
              {yScale.ticks(4).map(
                (tick) =>
                  yScale(tick) <= chartHeight && (
                    <G
                      key={tick.toString()}
                      transform={`translate(0, ${yScale(tick)})`}
                    >
                      <Line
                        x1={0}
                        x2={chartWidth}
                        y1={0}
                        y2={0}
                        stroke="#FFFFFF29"
                        strokeDasharray="2 2"
                      />
                      <SvgText
                        x={-10}
                        y={0}
                        textAnchor="end"
                        fontSize={10}
                        fill="white"
                      >
                        {yAxisFormatter(tick)}
                      </SvgText>
                    </G>
                  )
              )}
              {showTransactionInfo &&
                txXAxisLabels.map((t, index) => {
                  return (
                    <Fragment key={t.x + index.toString()}>
                      <G
                        transform={`translate(${t.x}, 0)`}
                        onLayout={(e) => handleXAxisLayout(e, t.index, t.x)}
                      >
                        <Line
                          x1={0}
                          x2={0}
                          y1={0}
                          y2={chartHeight}
                          stroke="#FFFFFF29"
                          strokeDasharray="2 2"
                        />
                        <SvgText
                          x={0}
                          y={chartHeight + 10}
                          textAnchor="start"
                          fontSize={10}
                          fill={t.textColor}
                        >
                          <TSpan x={0} dy={0}>
                            TX&nbsp;{t.index}
                          </TSpan>
                          <TSpan x={0} dy={10}>
                            {t.amountString}
                          </TSpan>
                          {t.type === 'receive' && (
                            <TSpan x={0} dy={10}>
                              {t.numberOfOutput} Output
                            </TSpan>
                          )}
                          {t.type === 'send' && (
                            <>
                              <TSpan x={0} dy={10}>
                                {t.numberOfInput} Input
                              </TSpan>
                              <TSpan x={0} dy={10}>
                                + change
                              </TSpan>
                            </>
                          )}
                        </SvgText>
                      </G>
                    </Fragment>
                  )
                })}
              {xScale.ticks(3).map((tick) => {
                const currentDate = d3.timeFormat('%b %d')(tick)
                const displayTime = previousDate === currentDate
                previousDate = currentDate
                return (
                  <G
                    key={tick.getTime().toString()}
                    transform={`translate(${xScale(tick)}, 0)`}
                  >
                    <SvgText
                      x={0}
                      y={chartHeight + (showTransactionInfo ? 50 : 20)}
                      dy=".71em"
                      fontSize={10}
                      fill="#777777"
                      textAnchor="middle"
                    >
                      {displayTime
                        ? d3.timeFormat('%b %d %H:%M')(tick)
                        : currentDate}
                    </SvgText>
                  </G>
                )
              })}
              <Defs>
                <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="white" stopOpacity="0.5" />
                  <Stop offset="100%" stopColor="white" stopOpacity="0.3" />
                </LinearGradient>
                <LinearGradient id="gradientBlack" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor="transparent" stopOpacity="0.0" />
                  <Stop
                    offset="70%"
                    stopColor="transparent"
                    stopOpacity="0.0"
                  />
                  <Stop offset="70%" stopColor="white" stopOpacity="0.0" />
                  <Stop offset="100%" stopColor="black" stopOpacity="0.6" />
                </LinearGradient>
                <LinearGradient id="gradientWhite" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor="white" stopOpacity="0.6" />
                  <Stop offset="30%" stopColor="white" stopOpacity="0.0" />
                  <Stop
                    offset="30%"
                    stopColor="transparent"
                    stopOpacity="0.0"
                  />
                  <Stop
                    offset="100%"
                    stopColor="transparent"
                    stopOpacity="0.0"
                  />
                </LinearGradient>
                <LinearGradient id="gradientBoth" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor="white" stopOpacity="0.6" />
                  <Stop offset="30%" stopColor="white" stopOpacity="0.0" />
                  <Stop
                    offset="30%"
                    stopColor="transparent"
                    stopOpacity="0.0"
                  />
                  <Stop
                    offset="70%"
                    stopColor="transparent"
                    stopOpacity="0.0"
                  />
                  <Stop offset="70%" stopColor="white" stopOpacity="0.0" />
                  <Stop offset="100%" stopColor="black" stopOpacity="0.6" />
                </LinearGradient>
                <ClipPath id="clip">
                  <Rect x="0" y="0" width={chartWidth} height={chartHeight} />
                </ClipPath>
              </Defs>
              <G clipPath="url(#clip)" pointerEvents="box-none">
                {showOutputField &&
                  utxoRectangleData.map((data, index) => {
                    return (
                      <Fragment key={getUtxoOutpoint(data.utxo) + index}>
                        <Rect
                          x={data.x1}
                          y={data.y1}
                          width={data.x2 - data.x1}
                          height={data.y2 - data.y1}
                          fill="url(#gradient)"
                          stroke="gray"
                          strokeOpacity={0.8}
                          strokeWidth={0.5}
                          pointerEvents="none"
                        />
                        {data.gradientType !== 0 && (
                          <>
                            <Defs>
                              <Mask id={getUtxoOutpoint(data.utxo) + index}>
                                <Rect
                                  x={data.x1}
                                  y={data.y1}
                                  width={data.x2 - data.x1}
                                  height={data.y2 - data.y1}
                                  fill={`url(#${data.gradientType === 1 ? 'gradientBlack' : data.gradientType === 2 ? 'gradientBoth' : 'gradientWhite'})`}
                                />
                              </Mask>
                            </Defs>
                            <Rect
                              key={getUtxoOutpoint(data.utxo) + index + '-mask'}
                              x={data.x1}
                              y={data.y1}
                              width={data.x2 - data.x1}
                              height={data.y2 - data.y1}
                              fill={`url(#${data.gradientType === 1 ? 'gradientBlack' : data.gradientType === 2 ? 'gradientBoth' : 'gradientWhite'})`}
                              pointerEvents="none"
                            />
                          </>
                        )}
                      </Fragment>
                    )
                  })}
                {showOutputField &&
                  utxoLabels.map((data, index) => {
                    if (data.x2 - data.x1 >= 50 && data.y1 - data.y2 >= 10) {
                      return (
                        <SvgText
                          key={getUtxoOutpoint(data.utxo) + index}
                          x={data.x1 + 2}
                          y={data.y2 + 10}
                          fontSize={10}
                          fill="white"
                        >
                          {data.utxo.txid.slice(0, 3) +
                            '...' +
                            data.utxo.txid.slice(-3) +
                            ':' +
                            data.utxo.vout}
                        </SvgText>
                      )
                    } else {
                      return null
                    }
                  })}
                {txInfoLabels.map((label, index) => {
                  if (label.type === 'end') {
                    return null
                  }
                  return (
                    <Fragment key={index}>
                      <SvgText
                        key={index}
                        x={
                          label.boundBox === undefined
                            ? label.x
                            : label.boundBox.left
                        }
                        y={
                          label.boundBox === undefined
                            ? label.y
                            : label.boundBox.bottom
                        }
                        textAnchor={
                          label.type === 'receive' &&
                          label.boundBox === undefined
                            ? 'end'
                            : 'start'
                        }
                        fontSize={10}
                        fill={label.type === 'receive' ? '#A7FFAF' : '#FF7171'}
                        onLayout={(e) =>
                          handleTxInfoLayout(
                            e,
                            index,
                            label.x,
                            label.y,
                            label.type
                          )
                        }
                      >
                        {(showLabel && label.memo!) ||
                          (showAmount && numberCommaFormatter(label.amount!)) ||
                          ''}
                      </SvgText>
                    </Fragment>
                  )
                })}
                <Path
                  d={linePath ?? ''}
                  fill="none"
                  stroke="white"
                  strokeWidth={2}
                  pointerEvents="none"
                />
                {!showOutputField && (
                  <Path d={areaPath ?? ''} fill="url(#gradient)" />
                )}
                {cursorX !== undefined && (
                  <G>
                    <Line
                      x1={xScale(cursorX)}
                      x2={xScale(cursorX)}
                      y1={20}
                      y2={chartHeight}
                      stroke="white"
                      strokeDasharray="10 2"
                    />
                    <SvgText
                      x={xScale(cursorX)}
                      y={10}
                      textAnchor="middle"
                      fontSize={12}
                      fill="white"
                    >
                      {cursorFormatter(cursorY ?? 0)}
                    </SvgText>
                  </G>
                )}
              </G>
            </G>
          </Svg>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1
  }
})

export default SSBalanceChart
