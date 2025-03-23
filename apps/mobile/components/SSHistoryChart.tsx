import {
  Canvas,
  DashPathEffect,
  Group,
  Line,
  LinearGradient,
  matchFont,
  Path,
  Rect,
  rect,
  Skia,
  Text,
  TileMode,
  useFonts,
  vec
} from '@shopify/react-native-skia'
import * as d3 from 'd3'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
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
    new Date(currentDate.current).setDate(currentDate.current.getDate() + 10) -
    chartData[0].date.getTime()
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

  const panGesture = Gesture.Pan()
    .minDistance(1)
    .maxPointers(1)
    .onStart(() => {
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
          new Date(transactions[0].timestamp!).getTime()
        )
      )
      setLocationState((prev) => ({ ...prev, endDate: endDateRef.current }))
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
    })
    .onEnd(() => {
      prevEndDate.current = endDate
      prevStartY.current = startY
    })
    .runOnJS(true)

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const cScale = Math.max(prevScale.current * event.scale, 1)
      const middleDate =
        endDateRef.current.getTime() - timeOffset / scaleRef.current / 2
      endDateRef.current = new Date(middleDate + timeOffset / cScale / 2)
      scaleRef.current = cScale
      setLocationState((prev) => ({
        ...prev,
        endDate: endDateRef.current,
        scale: cScale
      }))
    })
    .onEnd(() => {
      prevScale.current = scale
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
              `/account/${id}/transaction/${tappedRect.utxo.txid}/utxo/${tappedRect.utxo.vout}`
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
            router.navigate(`/account/${id}/transaction/${tapLabelRect.id}`)
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
        amountString: `${amount >= 0 ? '+' : ''}${numberCommaFormatter(amount)}`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddresses, xScaleTransactions, xScale, showTransactionInfo])

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
      for (let j = i + 1; j < initialLabels.length; j++) {
        const boundBoxB = initialLabels[j].boundBox
        if (boundBoxA !== undefined && boundBoxB !== undefined) {
          if (isOverlapping(boundBoxA!, boundBoxB!)) {
            initialLabels[j].y -= 30
            initialLabels[j].boundBox!.top -= 30
            initialLabels[j].boundBox!.bottom -= 30
          }
        }
      }
    }
    return initialLabels
  }, [showAmount, showLabel, validChartData, xScale, yScale])

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

  let previousDate: string = ''

  function YScaleRendrer() {
    if (!customFontManager) {
      return null
    }
    const font = matchFont(fontStyle, customFontManager)
    return yScale.ticks(4).map((tick) => {
      const yPosition = yScale(tick)
      return (
        yPosition <= chartHeight && (
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
      )
    })
  }

  function XScaleRenderer() {
    if (!customFontManager) {
      return null
    }
    const font = matchFont(fontStyle, customFontManager)
    return (
      showTransactionInfo &&
      !!txXAxisLabels?.length &&
      txXAxisLabels.map((t, index) => {
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
      })
    )
  }

  function XAxisRenderer() {
    if (!customFontManager) {
      return null
    }
    const font = matchFont(fontStyle, customFontManager)
    return xScale.ticks(3).map((tick) => {
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
    })
  }

  function AreaPathRenderer() {
    const path = useMemo(() => {
      if (areaPath === null) {
        return null
      }
      return Skia.Path.MakeFromSVGString(areaPath)
    }, [])

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

  function UtxoRectRenderer() {
    return (
      showOutputField &&
      utxoRectangleData.map((data, index) => {
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
      })
    )
  }

  function UtxoLabelRenderer() {
    if (!customFontManager) {
      return null
    }
    const font = matchFont(fontStyle, customFontManager)
    return (
      showOutputField &&
      utxoLabels.map((data, index) => {
        if (data.x2 - data.x1 >= 50 && data.y1 - data.y2 >= 10) {
          return (
            <Text
              key={getUtxoOutpoint(data.utxo) + index}
              x={data.x1 + 2}
              y={data.y2 + 10}
              text={
                data.utxo.txid.slice(0, 3) +
                '...' +
                data.utxo.txid.slice(-3) +
                ':' +
                data.utxo.vout
              }
              font={font}
              color="white"
            />
          )
        } else {
          return null
        }
      })
    )
  }

  function TransactionInfoRenderer() {
    if (!customFontManager) {
      return null
    }
    const font = matchFont(fontStyle, customFontManager)
    labelRectRef.current = []
    return txInfoLabels.map((label, index) => {
      if (label.type === 'end') {
        return null
      }
      const text =
        (showLabel && label.memo!) ||
        (showAmount && numberCommaFormatter(label.amount!)) ||
        ''
      const textWidth = font.measureText(text).width
      labelRectRef.current.push({
        rect: {
          left: label.type === 'receive' ? label.x - textWidth : label.x,
          right: label.type === 'receive' ? label.x : label.x + textWidth,
          bottom: label.y,
          top: label.y - 10
        },
        id: label.id
      })
      return (
        <Fragment key={index}>
          <Text
            x={label.type === 'receive' ? label.x - textWidth : label.x}
            y={label.y}
            text={text}
            font={font}
            color={label.type === 'receive' ? '#A7FFAF' : '#FF7171'}
          />
        </Fragment>
      )
    })
  }

  function CursorRenderer() {
    if (!customFontManager) {
      return null
    }
    const font = matchFont(fontStyle, customFontManager)
    return (
      cursorX !== undefined && (
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
    )
  }

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
            <YScaleRendrer />
            <XScaleRenderer />
            <XAxisRenderer />
            <Group clip={clipPathRect}>
              {showOutputField && (
                <>
                  <UtxoRectRenderer />
                  <UtxoLabelRenderer />
                </>
              )}
              <TransactionInfoRenderer />
              <Path
                path={linePath ?? ''}
                color="white"
                strokeWidth={2}
                style="stroke"
              />
              {!showOutputField && <AreaPathRenderer />}
              <CursorRenderer />
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

export default SSHistoryChart
