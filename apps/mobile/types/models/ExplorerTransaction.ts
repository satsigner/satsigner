export type ExplorerTxInput = {
  prevTxid: string
  prevVout: number
  sequence: number
  scriptSig: string
  witness: string[]
  isCoinbase: boolean
}

export type ExplorerTxOutput = {
  index: number
  value: number
  script: string
}

export type ExplorerTransaction = {
  txid: string
  version: number
  locktime: number
  size: number
  vsize: number
  weight: number
  isCoinbase: boolean
  isSegwit: boolean
  inputs: ExplorerTxInput[]
  outputs: ExplorerTxOutput[]
}
