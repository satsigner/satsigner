import { format } from 'd3-format'
import { type ScaleLinear, type ScaleTime } from 'd3-scale'

import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Rectangle } from '@/types/ui/geometry'
import { formatFiatPrice, formatNumber } from '@/utils/format'
import { isOverlapping } from '@/utils/geometry'

export type HistoryChartData = {
  memo: string
  date: Date
  balance: number
  amount: number
  type: 'send' | 'receive' | 'end'
  id: string
}

type XScale = ScaleTime<number, number>
type YScale = ScaleLinear<number, number>

type BalanceHistory = Map<number, Map<string, Utxo>>

type UtxoRectangle = {
  x1: number
  x2: number
  y1: number
  y2: number
  utxo: Utxo
  gradientType: number
}

type UtxoLabel = {
  x1: number
  x2: number
  y1: number
  y2: number
  utxo: Utxo
}

type TxXAxisLabel = {
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
}

type TxInfoLabel = {
  x: number
  y: number
  memo?: string
  amount?: number
  fiatValue?: number
  historicalFiatValue?: number
  type: string
  boundBox?: Rectangle
  index: string
  id: string
}

type UtxoGeometryParams = {
  balanceHistory: BalanceHistory
  transactions: Transaction[]
  xScale: XScale
  yScale: YScale
  chartWidth: number
  currentDate: Date
}

type TxXAxisLabelsParams = {
  transactions: Transaction[]
  walletAddresses: Set<string>
  xScale: XScale
  startDate: Date
  endDate: Date
  chartHeight: number
  zeroPadding: boolean
  blockchainHeight?: number
  showTransactionInfo: boolean
}

type TxInfoLabelsParams = {
  validChartData: HistoryChartData[]
  transactionsMap: Map<string, Transaction>
  xScale: XScale
  yScale: YScale
  chartWidth: number
  chartHeight: number
  showAmount: boolean
  showLabel: boolean
  showFiatOnChart: boolean
  showFiatAtTxTime: boolean
  showHistoricalFiat: boolean
  effectiveBtcPrice: number
  satsToFiat: (sats: number) => number
  fiatCurrency: Currency
}

export function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export function buildTransactionsMap(
  transactions: Transaction[]
): Map<string, Transaction> {
  const map = new Map<string, Transaction>()
  for (const t of transactions) {
    map.set(t.id, t)
  }
  return map
}

export function buildWalletAddresses(
  transactions: Transaction[],
  utxos: Utxo[]
): Set<string> {
  const addresses = new Set<string>()
  const transactionsMap = buildTransactionsMap(transactions)
  for (const val of utxos) {
    addresses.add(val.addressTo ?? '')
  }
  for (const t of transactions.filter((t) => t.type === 'send')) {
    for (const input of t.vin ?? []) {
      addresses.add(
        transactionsMap
          .get(input?.previousOutput?.txid ?? '')
          ?.vout?.at(input?.previousOutput?.vout ?? 0)?.address ?? ''
      )
    }
  }
  addresses.delete('')
  return addresses
}

export function buildChartData(
  transactions: Transaction[],
  currentDate: Date
): HistoryChartData[] {
  let sum = 0
  return transactions.map((transaction) => {
    const amount =
      transaction.type === 'receive'
        ? (transaction?.received ?? 0)
        : (transaction?.received ?? 0) - (transaction?.sent ?? 0)
    sum += amount
    return {
      amount,
      balance: sum,
      date: new Date(transaction?.timestamp ?? currentDate),
      id: transaction.id,
      memo: transaction.label ?? '',
      type: transaction.type ?? 'receive'
    }
  })
}

export function buildBalanceHistory(
  transactions: Transaction[],
  walletAddresses: Set<string>
): BalanceHistory {
  const history: BalanceHistory = new Map()
  const pendingDeleteBalances = new Set<string>()
  for (const [index, t] of transactions.entries()) {
    const currentBalances = new Map<string, Utxo>()
    if (index > 0) {
      for (const [key, value] of history.get(index - 1)!) {
        currentBalances.set(key, { ...value })
      }
    }
    if (t.type === 'receive') {
      for (const [outIdx, out] of t.vout.entries()) {
        if (walletAddresses.has(out.address)) {
          const outName = `${t.id}::${outIdx}`
          currentBalances.set(outName, {
            addressTo: out.address,
            keychain: 'internal',
            label: '',
            txid: t.id,
            value: out.value,
            vout: outIdx
          })
        }
      }
    } else if (t.type === 'send') {
      for (const input of t.vin ?? []) {
        const inputName = `${input.previousOutput.txid}::${input.previousOutput.vout}`
        if (currentBalances.has(inputName)) {
          currentBalances.delete(inputName)
        } else {
          pendingDeleteBalances.add(inputName)
        }
      }
      for (const [outIdx, out] of (t.vout ?? []).entries()) {
        if (walletAddresses.has(out.address)) {
          const outName = `${t.id}::${outIdx}`
          currentBalances.set(outName, {
            addressTo: out.address,
            keychain: 'internal',
            label: '',
            txid: t.id,
            value: out.value,
            vout: outIdx
          })
        }
      }
    }
    history.set(index, currentBalances)
  }
  for (const value of pendingDeleteBalances) {
    for (const [, historyBalance] of history.entries()) {
      if (historyBalance.has(value)) {
        historyBalance.delete(value)
      }
    }
    pendingDeleteBalances.delete(value)
  }
  return history
}

export function computeValidChartData(
  chartData: HistoryChartData[],
  startDate: Date,
  endDate: Date,
  currentDate: Date,
  lockZoomToXAxis: boolean
): [number, HistoryChartData[]] {
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
    amount: 0,
    balance: startBalance,
    date: startDate,
    id: '',
    memo: '',
    type: 'end'
  })
  if (endDate.getTime() <= currentDate.getTime()) {
    validData.push({
      amount: 0,
      balance: validData.at(-1)?.balance ?? 0,
      date: endDate,
      id: '',
      memo: '',
      type: 'end'
    })
  } else {
    validData.push({
      amount: 0,
      balance: validData.at(-1)?.balance ?? 0,
      date: currentDate,
      id: '',
      memo: '',
      type: 'end'
    })
  }
  return [maxBalance, validData]
}

export function buildUtxoRectangles({
  balanceHistory,
  transactions,
  xScale,
  yScale,
  chartWidth,
  currentDate
}: UtxoGeometryParams): UtxoRectangle[] {
  return Array.from(balanceHistory.entries())
    .flatMap(([index, balances]) => {
      const x1 = xScale(
        new Date(transactions.at(index)?.timestamp ?? currentDate)
      )
      const x2 = xScale(
        index === transactions.length - 1
          ? currentDate
          : new Date(transactions.at(index + 1)?.timestamp ?? currentDate)
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
          gradientType = gradientType === 1 ? 2 : -1
        }
        return {
          gradientType,
          utxo,
          x1,
          x2,
          y1,
          y2
        }
      })
    })
    .filter((v) => v !== undefined)
}

export function buildUtxoLabels({
  balanceHistory,
  transactions,
  xScale,
  yScale,
  chartWidth,
  currentDate
}: UtxoGeometryParams): UtxoLabel[] {
  const result: UtxoLabel[] = []
  for (const [index, balances] of balanceHistory.entries()) {
    const x1 = xScale(
      new Date(transactions.at(index)?.timestamp ?? currentDate)
    )
    const x2 = xScale(
      index === transactions.length - 1
        ? currentDate
        : new Date(transactions.at(index + 1)?.timestamp ?? currentDate)
    )
    if (x2 < 0 && x1 >= chartWidth) {
      continue
    }
    let totalBalance = 0
    for (const [, utxo] of balances.entries()) {
      const y1 = yScale(totalBalance)
      const y2 = yScale(totalBalance + utxo.value)
      totalBalance += utxo.value
      if (utxo.txid === transactions.at(index)?.id) {
        result.push({
          utxo,
          x1,
          x2,
          y1,
          y2
        })
      }
    }
  }
  return result
}

export function buildTxXAxisLabels({
  transactions,
  walletAddresses,
  xScale,
  startDate,
  endDate,
  chartHeight,
  zeroPadding,
  blockchainHeight,
  showTransactionInfo
}: TxXAxisLabelsParams): TxXAxisLabel[] {
  if (!showTransactionInfo) {
    return []
  }
  const numberCommaFormatter = format(',')
  const xScaleTransactions = transactions
    .map((t, index) => ({ ...t, index }))
    .filter(
      (t) =>
        new Date(t?.timestamp ?? 0) >= startDate &&
        new Date(t?.timestamp ?? 0) <= endDate
    )
  const { length } = xScaleTransactions
  const xAxisLabels = xScaleTransactions.map((t) => {
    const amount = t.type === 'receive' ? t.received : t.received - t.sent
    const numberOfInput = t.vin?.length ?? 0
    const numberOfOutput = t.vout?.length ?? 0
    const hasChange =
      t.type === 'send' &&
      t.vout.some((out) => walletAddresses.has(out.address))
    const confirmationsCount =
      blockchainHeight && t.blockHeight
        ? blockchainHeight - t.blockHeight + 1
        : undefined
    const confirmations =
      confirmationsCount !== undefined
        ? confirmationsCount <= 0
          ? '0 confs'
          : `${numberCommaFormatter(confirmationsCount)} confs`
        : undefined
    return {
      amountString: `${amount >= 0 ? '+' : ''}${formatNumber(
        amount,
        0,
        zeroPadding
      )}`,
      confirmations,
      fee: t.fee,
      hasChange,
      index: t.index,
      label: t.label,
      numberOfInput,
      numberOfOutput,
      textColor: '',
      type: t.type,
      x: xScale(new Date(t.timestamp ?? new Date()))
    }
  })
  const boundaryBoxes: { [key: string]: Rectangle } = {}
  for (const t of xAxisLabels) {
    boundaryBoxes[t.index] = {
      bottom: chartHeight + 50,
      height: 50,
      left: t.x,
      right: 60 + t.x,
      top: chartHeight,
      width: 60
    }
  }
  const visible: { [key: string]: boolean } = {}
  for (let i = 0; i < length; i += 1) {
    visible[xScaleTransactions[i].index] = true
  }
  for (let i = 0; i < length - 1; i += 1) {
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
  return xAxisLabels.map((x) => ({
    ...x,
    textColor: visible[x.index] ? 'white' : 'transparent'
  }))
}

export function buildTxInfoLabels({
  validChartData,
  transactionsMap,
  xScale,
  yScale,
  chartWidth,
  chartHeight,
  showAmount,
  showLabel,
  showFiatOnChart,
  showFiatAtTxTime,
  showHistoricalFiat,
  effectiveBtcPrice,
  satsToFiat,
  fiatCurrency
}: TxInfoLabelsParams): TxInfoLabel[] {
  if (!showAmount && !showLabel) {
    return []
  }
  const initialLabels: TxInfoLabel[] = []

  for (const d of validChartData) {
    if (d.type === 'end') {
      continue
    }
    const x = Math.round(xScale(d.date) + (d.type === 'receive' ? -5 : +5))
    const y = Math.round(yScale(d.balance) - 5)
    if (x < 0 || x > chartWidth || y < 0 || y > chartHeight) {
      continue
    }
    if (showLabel && d.memo) {
      const index = `${d.date.getTime().toString()}${d.balance.toString()}L`
      const width = 40
      const height = 10
      const left = Math.round(d.type === 'receive' ? x - width : x)
      const right = Math.round(d.type === 'receive' ? x : x + width)
      const bottom = y
      const top = y - height
      initialLabels.push({
        boundBox: {
          bottom: bottom + (showAmount ? -15 : 0),
          height,
          left,
          right,
          top: top + (showAmount ? -15 : 0),
          width
        },
        id: d.id,
        index,
        memo: d.memo,
        type: d.type,
        x,
        y: y + (showAmount ? -15 : 0)
      })
    }
    if (showAmount) {
      const index = `${d.date.getTime().toString()}${d.balance.toString()}A`
      const width = 40
      const height = 10
      const left = Math.round(d.type === 'receive' ? x - width : x)
      const right = Math.round(d.type === 'receive' ? x : x + width)
      const bottom = y
      const top = y - height
      const transaction = transactionsMap.get(d.id)
      const historicalPrice =
        showFiatAtTxTime &&
        showHistoricalFiat &&
        transaction?.prices &&
        transaction.prices[fiatCurrency]
          ? transaction.prices[fiatCurrency]
          : undefined
      const historicalFiatValue =
        historicalPrice && d.amount !== undefined
          ? parseFloat(formatFiatPrice(d.amount, historicalPrice))
          : undefined

      initialLabels.push({
        amount: d.amount,
        boundBox: {
          bottom:
            showFiatOnChart && effectiveBtcPrice > 0 ? bottom - 10 : bottom,
          height:
            showFiatOnChart && effectiveBtcPrice > 0
              ? height + (showFiatAtTxTime && historicalFiatValue ? 12 : 12)
              : height,
          left,
          right,
          top: showFiatOnChart && effectiveBtcPrice > 0 ? top - 10 : top,
          width
        },
        fiatValue:
          showFiatOnChart && effectiveBtcPrice > 0 && d.amount !== undefined
            ? satsToFiat(d.amount)
            : undefined,
        historicalFiatValue,
        id: d.id,
        index,
        type: d.type,
        x,
        y: showFiatOnChart && effectiveBtcPrice > 0 ? y - 10 : y
      })
    }
  }

  for (let i = 0; i < initialLabels.length - 1; i += 1) {
    const boundBoxA = initialLabels[i].boundBox
    if (!boundBoxA) {
      continue
    }
    for (let j = i + 1; j < initialLabels.length; j += 1) {
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
}
