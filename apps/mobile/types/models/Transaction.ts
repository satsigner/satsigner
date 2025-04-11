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
    scriptSig: number[]
    witness: number[][]
    value?: number
    label?: string
  }[]
  vout: {
    value: number
    address: string
    script: number[]
    label?: string
  }[]
  prices: Prices
}
