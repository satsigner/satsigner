import * as d3 from 'd3'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
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
  Path,
  Rect,
  Stop,
  Text as SvgText,
  TSpan
} from 'react-native-svg'

import { Transaction } from '@/types/models/Transaction'
import { Utxo } from '@/types/models/Utxo'
import { AccountSearchParams } from '@/types/navigation/searchParams'

type BalanceChartData = {
  memo: string
  date: Date
  balance: number
  amount: number
  type: 'send' | 'receive'
}

type Rectangle = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

export type SSBalanceChartProps = {
  transactions: Transaction[]
  utxos: Utxo[]
}

// Function to check if two rectangles overlap
const isOverlapping = (rect1: Rectangle, rect2: Rectangle) => {
  if (rect1.right < rect2.left || rect2.right < rect1.left) return false
  if (rect1.bottom < rect2.top || rect2.bottom < rect1.top) return false
  return true
}

const adjustLabelPositions = (labels) => {
  const adjustedLabels = [...labels]
  for (let i = 0; i < adjustedLabels.length; i++) {
    for (let j = i + 1; j < adjustedLabels.length; j++) {
      if (isOverlapping(adjustedLabels[i].bbox, adjustedLabels[j].bbox)) {
        adjustedLabels[j].y -= 20
        adjustedLabels[j].bbox.top -= 20
        adjustedLabels[j].bbox.bottom -= 20
      }
    }
  }
  return adjustedLabels
}

function SSBalanceChartLabels({ data, transformedXScale, transformedYScale }) {
  const [labels, setLabels] = useState([])

  useEffect(() => {
    const initialLabels = []
    for (const d of data) {
      const x = transformedXScale(d.date) + (d.type === 'receive' ? -5 : 5)
      const y = transformedYScale(d.balance) - 10
      const textSize = { width: 50, height: 30 }
      const bbox = {
        left: d.type === 'send' ? x : x - textSize.width,
        right: d.type === 'send' ? x + textSize.width : x,
        top: y,
        bottom: y + textSize.height
      }
      initialLabels.push({
        x,
        y,
        bbox,
        memo: d.memo,
        amount: d.amount,
        type: d.type
      })
    }
    const adjustedLabels = adjustLabelPositions(initialLabels)
    setLabels(adjustedLabels)
    //setLabels(initialLabels)
  }, [data, transformedXScale, transformedYScale])
  return (
    <>
      {labels.map((label, index) => (
        <SvgText
          key={index}
          x={label.x}
          y={label.y}
          textAnchor={label.type === 'send' ? 'start' : 'end'}
          fontSize={10}
          fill={label.type === 'receive' ? '#A7FFAF' : '#FF7171'}
        >
          {label.memo || label.amount}
        </SvgText>
      ))}
    </>
  )
}

function SSBalanceChart({ transactions, utxos }: SSBalanceChartProps) {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const [walletAddresses] = useMemo(() => {
    const addresses = new Set<string>()
    const transactinsMap = new Map<string, Transaction>()
    utxos.forEach((val) => {
      addresses.add(val?.addressTo ?? '')
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
    const sortedAddressList = new Set<string>()
    transactions.forEach((t) => {
      t.vout?.forEach((out) => {
        if (addresses.has(out?.address)) {
          sortedAddressList.add(out?.address)
        }
      })
    })
    return [addresses, [...sortedAddressList]]
  }, [transactions, utxos])

  const balanceHistory = useMemo(() => {
    type UTXOItem = {
      prevTxId: string
      outputIndex: number
      outputString: string
      address: string
      balance: number
    }
    const history = new Map<number, Map<string, UTXOItem>>()
    transactions.forEach((t, index) => {
      const currentBalances = new Map<string, UTXOItem>()
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
              address: out.address,
              balance: out.value,
              outputIndex: index,
              outputString: outName,
              prevTxId: t.id
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
              address: out.address,
              balance: out.value,
              outputIndex: index,
              outputString: outName,
              prevTxId: t.id
            })
          }
        })
      }
      history.set(index, currentBalances)
    })
    return history
  }, [transactions, walletAddresses])

  const data: BalanceChartData[] = useMemo(() => {
    let sum = 0
    const result = transactions.map((transaction) => {
      const amount =
        transaction.type === 'receive'
          ? transaction?.received ?? 0
          : (transaction?.received ?? 0) - (transaction?.sent ?? 0)
      sum += amount
      return {
        memo: transaction.label ?? '',
        date: new Date(transaction?.timestamp ?? new Date()),
        type: transaction.type ?? 'receive',
        balance: sum,
        amount
      }
    })
    result.push({
      amount: 0,
      balance: result.at(result.length - 1)?.balance ?? 0,
      date: new Date(),
      memo: '',
      type: 'receive'
    })
    return result
  }, [transactions])
  const timeOffset = Date.now() - data[0].date.getTime()
  const margin = { top: 30, right: 0, bottom: 80, left: 40 }
  const [containerSize, setContainersize] = useState({ width: 0, height: 0 })

  const [scale, setScale] = useState<number>(1) // Zoom scale
  const [cursorX, setCursorX] = useState<Date | undefined>(undefined)
  const [cursorY, setCursorY] = useState<number | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [prevEndDate, setPrevEndDate] = useState<Date>(new Date())

  const startDate = useMemo<Date>(() => {
    return new Date(endDate.getTime() - timeOffset / scale)
  }, [endDate, scale, timeOffset])

  const [, /*minBalance,*/ maxBalance, validData] = useMemo(() => {
    let minBalance = Number.MAX_VALUE
    let maxBalance = Number.MIN_VALUE
    const startBalance = data.findLast((d) => d.date < startDate)?.balance ?? 0
    const validData = data.filter(
      (d) => d.date >= startDate && d.date <= endDate
    )
    validData.forEach((d) => {
      minBalance = Math.min(d.balance, minBalance)
      maxBalance = Math.max(d.balance, maxBalance)
    })
    minBalance = Math.min(startBalance, minBalance)
    maxBalance = Math.max(startBalance, maxBalance)
    if (maxBalance === Number.MIN_VALUE) {
      maxBalance = 1
    }
    validData.unshift({
      date: startDate,
      amount: 0,
      balance: startBalance,
      memo: '',
      type: 'receive'
    })
    validData.push({
      date: endDate,
      amount: 0,
      balance: validData[validData.length - 1]?.balance ?? 0,
      memo: '',
      type: 'receive'
    })
    return [minBalance, maxBalance, validData]
  }, [startDate, endDate, data])

  const chartWidth = containerSize.width - margin.left - margin.right
  const chartHeight = containerSize.height - margin.top - margin.bottom

  const xScale = useMemo(() => {
    return d3.scaleTime().domain([startDate, endDate]).range([0, chartWidth])
  }, [chartWidth, endDate, startDate])

  const yScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain([0, maxBalance * 1.1])
      .range([chartHeight, 0])
  }, [chartHeight, maxBalance])

  const utxoRectangleData = useMemo(() => {
    return Array.from(balanceHistory.entries()).flatMap(([index, balances]) => {
      const x1 = xScale(new Date(transactions.at(index)?.timestamp!))
      const x2 = xScale(
        index === transactions.length - 1
          ? new Date()
          : new Date(transactions.at(index + 1)?.timestamp!)
      )
      let totalBalance = 0
      return Array.from(balances.entries()).map(([, utxo]) => {
        const y1 = yScale(totalBalance)
        const y2 = yScale(totalBalance + utxo.balance)
        totalBalance += utxo.balance
        return {
          x1,
          x2,
          y1,
          y2,
          utxo
        }
      })
    })
  }, [balanceHistory, transactions, xScale, yScale])

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
    .onStart(() => {
      setPrevEndDate(endDate)
    })
    .onUpdate((event) => {
      setEndDate(
        new Date(
          Math.min(
            prevEndDate.getTime() -
              ((timeOffset / scale) * event.translationX) / chartWidth,
            Date.now()
          )
        )
      )
    })
    .onEnd(() => {
      setPrevEndDate(endDate)
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
          const index = validData.findLastIndex((d) => d.date <= selectedDate)
          if (index >= 0) {
            setCursorY(validData[index].balance)
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
              `/account/${id}/transaction/${tappedRect.utxo.prevTxId}/utxo/${tappedRect.utxo.outputIndex}`
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

  // const areaGenerator = useMemo(() => {
  //   return d3
  //     .area<BalanceChartData>()
  //     .x((d) => xScale(d.date))
  //     .y0(chartHeight)
  //     .y1((d) => yScale(d.balance))
  //     .curve(d3.curveStepAfter)
  // }, [chartHeight, xScale, yScale])

  const linePath = lineGenerator(validData)
  //const areaPath = areaGenerator(validData)

  const yAxisFormatter = d3.format('.3s')
  const cursorFormatter = d3.format(',d')

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainersize({ width, height })
  }, [])

  const [txXBoundbox, setTxXBoundBox] = useState<{ [key: string]: Rectangle }>(
    {}
  )

  const handleXAxisLayout = useCallback(
    (event: LayoutChangeEvent, t, x) => {
      const rect: Rectangle = {
        left: Math.round(x),
        right: Math.round(x + event.nativeEvent.layout.width),
        top: Math.round(chartHeight),
        bottom: Math.round(chartHeight + event.nativeEvent.layout.height),
        width: Math.round(event.nativeEvent.layout.width),
        height: Math.round(event.nativeEvent.layout.height)
      }
      if (
        txXBoundbox[t.index] !== undefined &&
        txXBoundbox[t.index].left === rect.left &&
        txXBoundbox[t.index].bottom === rect.bottom &&
        txXBoundbox[t.index].top === rect.top &&
        txXBoundbox[t.index].right === rect.right
      ) {
        return
      }
      setTxXBoundBox((prev) => ({
        ...prev,
        [t.index]: rect
      }))
    },
    [chartHeight, txXBoundbox]
  )

  const [txXBoundVisible, setTxXBoundVisible] = useState<{
    [key: string]: boolean
  }>({})

  useEffect(() => {
    const timerId = setTimeout(() => {
      const visible: { [key: string]: boolean } = {}
      const length = xScaleTransactions.length
      let i = 0
      for (i = 0; i < length - 1; i++) {
        if (
          txXBoundbox[xScaleTransactions[i].index] !== undefined &&
          txXBoundbox[xScaleTransactions[i + 1].index] !== undefined
        ) {
          if (
            isOverlapping(
              txXBoundbox[xScaleTransactions[i].index],
              txXBoundbox[xScaleTransactions[i + 1].index]
            )
          ) {
            visible[xScaleTransactions[i].index] = false
          }
        }
      }
      for (i = 0; i < length; i++) {
        if (visible[xScaleTransactions[i].index] === undefined) {
          visible[xScaleTransactions[i].index] = true
        }
      }
      setTxXBoundVisible(visible)
    }, 500)

    return () => clearTimeout(timerId)
  }, [txXBoundbox, xScaleTransactions])

  if (!containerSize.width || !containerSize.height) {
    return <View onLayout={handleLayout} style={styles.container} />
  }

  let previousDate: string = ''
  //console.log('Rendering!!!', new Date())

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={combinedGesture}>
        <View style={styles.container} onLayout={handleLayout}>
          <Svg width={containerSize.width} height={containerSize.height}>
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
              {xScaleTransactions.map((t, index) => {
                const amount =
                  t.type === 'receive' ? t.received : t.received - t.sent
                let numberOfOutput: number = 0
                let numberOfInput: number = 0
                if (t.type === 'receive') {
                  numberOfOutput =
                    t.vout.filter((out) => walletAddresses.has(out.address))
                      .length ?? 0
                } else if (t.type === 'send') {
                  numberOfInput = t.vin?.length ?? 0
                }
                const textColor =
                  txXBoundVisible[t.index] === true ? 'white' : 'transparent'
                return (
                  <Fragment
                    key={
                      new Date(t.timestamp ?? new Date()).getTime().toString() +
                      index.toString()
                    }
                  >
                    {/* {txXBoundbox[t.index] !== undefined && (
                      <Rect
                        x={txXBoundbox[t.index].left}
                        y={txXBoundbox[t.index].top}
                        width={txXBoundbox[t.index].width}
                        height={txXBoundbox[t.index].height}
                        fill="transparent"
                        stroke="red"
                        strokeWidth={1}
                      />
                    )} */}
                    <G
                      key={
                        new Date(t.timestamp ?? new Date())
                          .getTime()
                          .toString() + index.toString()
                      }
                      transform={`translate(${xScale(new Date(t.timestamp ?? new Date()))}, 0)`}
                      onLayout={(e) =>
                        handleXAxisLayout(
                          e,
                          t,
                          xScale(new Date(t.timestamp ?? new Date()))
                        )
                      }
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
                        fill={textColor}
                      >
                        <TSpan x={0} dy={0}>
                          TX&nbsp;{t.index}
                        </TSpan>
                        <TSpan x={0} dy={10}>
                          {amount >= 0 ? '+' : ''}
                          {amount}
                        </TSpan>
                        {t.type === 'receive' && (
                          <TSpan x={0} dy={10}>
                            {numberOfOutput} Output
                          </TSpan>
                        )}
                        {t.type === 'send' && (
                          <>
                            <TSpan x={0} dy={10}>
                              {numberOfInput} Input
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
              {xScale.ticks(4).map((tick) => {
                const currentDate = d3.timeFormat('%b %d')(tick)
                const displayTime = previousDate === currentDate
                previousDate = currentDate
                return (
                  <G
                    key={tick.getTime().toString()}
                    transform={`translate(${xScale(tick)}, 0)`}
                  >
                    {/* <Line
                      x1={0}
                      x2={0}
                      y1={0}
                      y2={chartHeight}
                      stroke="#FFFFFF29"
                      strokeDasharray="2 2"
                    /> */}
                    <SvgText
                      x={0}
                      y={chartHeight + 50}
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
                  <Stop offset="0%" stopColor="white" stopOpacity="0.3" />
                  <Stop offset="100%" stopColor="white" stopOpacity="0.15" />
                </LinearGradient>
                <ClipPath id="clip">
                  <Rect x="0" y="0" width={chartWidth} height={chartHeight} />
                </ClipPath>
              </Defs>
              <G clipPath="url(#clip)">
                <Path
                  d={linePath ?? ''}
                  fill="none"
                  stroke="white"
                  strokeWidth={2}
                />
                {/* <Path d={areaPath ?? ''} fill="url(#gradient)" /> */}
                <SSBalanceChartLabels
                  data={validData}
                  transformedXScale={xScale}
                  transformedYScale={yScale}
                />
                {utxoRectangleData.map((data, index) => {
                  return (
                    <Rect
                      key={data.utxo.outputString + index}
                      x={data.x1}
                      y={data.y1}
                      width={data.x2 - data.x1}
                      height={data.y2 - data.y1}
                      fill="url(#gradient)"
                      stroke="gray"
                      strokeOpacity={0.8}
                      strokeWidth={0.5}
                    />
                  )
                })}
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
