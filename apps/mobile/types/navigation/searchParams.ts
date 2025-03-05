export type MultiSigKeySettingsSearchParams = {
  index: string
}

export type ConfirmWordSearchParams = {
  keyIndex: string
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
