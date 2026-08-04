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
  /** Confirmation height per txid, when the backend already exposed it. */
  heightByTxid?: Record<string, number>
  source: ExplorerDataSource
}
