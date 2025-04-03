export type Utxo = {
  txid: string
  vout: number
  value: number
  timestamp?: Date
  label?: string
  addressTo?: string
  keychain: 'internal' | 'external'
  script?: number[]
}
