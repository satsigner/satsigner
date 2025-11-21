export type MultiSigKeySettingsSearchParams = {
  index: string
}

export type GenerateMnemonicSearchParams = {
  index: string
}

export type ConfirmWordSearchParams = {
  keyIndex: string
  index: string
}

export type ImportMnemonicSearchParams = {
  keyIndex: string
}

export type ImportDescriptorSearchParams = {
  keyIndex: string
}

export type AccountSearchParams = {
  id: string
}

export type PreviewMessageSearchParams = AccountSearchParams & {
  psbt?: string
  signedPsbt?: string
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

export type EcashSearchParams = {
  mintUrl?: string
  amount?: string
  token?: string
  id?: string
}

export type DeviceAliasSearchParams = {
  npub: string
} & AccountSearchParams
