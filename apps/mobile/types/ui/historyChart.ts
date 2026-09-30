import { type ScaleLinear, type ScaleTime } from 'd3-scale'

import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Rectangle } from '@/types/ui/geometry'

export type HistoryChartData = {
  memo: string
  date: Date
  balance: number
  amount: number
  type: 'send' | 'receive' | 'end'
  id: string
}

export type XScale = ScaleTime<number, number>
export type YScale = ScaleLinear<number, number>

export type BalanceHistory = Map<number, Map<string, Utxo>>

export type UtxoRectangle = {
  x1: number
  x2: number
  y1: number
  y2: number
  utxo: Utxo
  gradientType: number
}

export type UtxoLabel = {
  x1: number
  x2: number
  y1: number
  y2: number
  utxo: Utxo
}

export type TxXAxisLabel = {
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

export type TxInfoLabel = {
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

export type UtxoGeometryParams = {
  balanceHistory: BalanceHistory
  transactions: Transaction[]
  xScale: XScale
  yScale: YScale
  chartWidth: number
  currentDate: Date
}

export type TxXAxisLabelsParams = {
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

export type TxInfoLabelsParams = {
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
