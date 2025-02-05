import type { Currency } from './Blockchain'

export type Transaction = {
  id: string
  type: 'send' | 'receive'
  sent: number
  received: number
  timestamp?: Date
  blockHeight?: number
  address?: string
  label?: string
  fee?: number
  size?: number
  vsize?: number
  weight?: number
  version?: number
  lockTime?: number
  lockTimeEnabled: boolean
  raw?: number[]
  vin?: {
    previousOutput: {
      txid: string
      vout: number
    }
    sequence: number
    scriptSig: number[]
    witness: number[][]
  }[]
  vout: {
    value: number
    address: string
    script: number[]
  }[]
  prices: Partial<{
    [key in Currency]: number
  }>
}
