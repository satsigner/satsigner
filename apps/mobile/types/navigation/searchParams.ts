export type ConfirmSearchParams = {
  index: string
}

export type AccountSearchParams = {
  id: string
}

export type TxSearchParams = {
  txid: string
} & AccountSearchParams

export type UtxoSearchParams = {
  vout: string
} & TxSearchParams
