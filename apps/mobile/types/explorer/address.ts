import type { ExplorerDataSource } from '@/types/explorer/capabilities'

export type ExplorerAddressUtxo = {
  txid: string
  vout: number
  value: number
  height?: number
}

export type ExplorerAddressData = {
  address: string
  confirmed: number
  unconfirmed: number
  utxos: ExplorerAddressUtxo[]
  txids: string[]
  source: ExplorerDataSource
}
