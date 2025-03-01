export type AccountSearchParams = {
  id: string
}

export type AddrSearchParams = {
  addr: string
} & AccountSearchParams

export type TxSearchParams = {
  txid: string
} & AccountSearchParams

export type UtxoSearchParams = {
  vout: string
} & TxSearchParams
