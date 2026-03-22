export interface MultiSigKeySettingsSearchParams {
  index: string
}

export interface GenerateMnemonicSearchParams {
  index: string
}

export interface ConfirmWordSearchParams {
  keyIndex: string
  index: string
}

export interface ImportMnemonicSearchParams {
  keyIndex: string
}

export interface ImportDescriptorSearchParams {
  keyIndex: string
}

export interface ExplorerBlockSearchParams {
  block: string
}

export interface AccountSearchParams {
  id: string
}

export type PreviewTransactionSearchParams = AccountSearchParams & {
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

export interface EcashSearchParams {
  mintUrl?: string
  amount?: string
  token?: string
  id?: string
}

export type DeviceAliasSearchParams = {
  npub: string
} & AccountSearchParams

export interface WatchOnlySearchParams {
  descriptor?: string
  extendedPublicKey?: string
}
