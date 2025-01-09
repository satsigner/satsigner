import { type Currency } from './Blockchain'

export type Transaction = {
  id: string
  type: 'send' | 'receive'
  sent: number
  received: number
  timestamp: Date
  blockHeight?: number
  memo?: string
  address?: string
  label?: string
  fee?: number
  size?: number
  vsize?: number
  weight?: number
  version?: number
  lockTime?: number
  raw?: number[]
  vout: {
    value: number
    address: string
  }[]
  prices: {
    [key in Currency]: number
  }
}
