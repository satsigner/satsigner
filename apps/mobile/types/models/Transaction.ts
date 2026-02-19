import { type Prices } from './Blockchain'

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
  vin: {
    previousOutput: {
      txid: string
      vout: number
    }
    sequence: number
    scriptSig: number[] | string
    witness: number[][]
    value?: number
    label?: string
  }[]
  vout: {
    value: number
    address: string
    script: number[] | string
    label?: string
  }[]
  prices: Prices
}
