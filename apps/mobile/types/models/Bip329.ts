import { type Currency } from './Blockchain'

export type Label = {
  text: string
  type: 'tx' | 'addr' | 'pubkey' | 'input' | 'output' | 'xpub'
  ref: string
  fee?: number
  fmv?: Record<Currency, number> // fair market value
  height?: number
  heights?: number[] // blocks with confirmed address activity
  keypath?: string
  origin?: string // key origin information
  rate?: Record<Currency, number> // exchange rates
  spendable?: boolean
  time?: string // ISO-8601 formatted block timestamp
  value?: number // Satoshis into/out of wallet
}
