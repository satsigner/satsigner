import { TransactionDetails } from 'bdk-rn/lib/classes/Bindings'

export type Utxo = {
  txid: string
  vout: number
  value: number
  timestamp?: Date
  label?: string
  addressTo?: string
  keychain: 'internal' | 'external'
  txDetails?: TransactionDetails
}
