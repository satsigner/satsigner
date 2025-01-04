export type Transaction = {
  id: string
  type: 'send' | 'receive'
  sent: number
  received: number
  timestamp?: Date
  blockHeight?: number
  memo?: string
  address?: string
  label?: string
  size: number
  vout: {
    value: number
    address: string
  }[]
}
