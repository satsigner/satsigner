export type ExplorerTxInput = {
  prevTxid: string
  prevVout: number
  sequence: number
  scriptSig: string
  witness: string[]
  isCoinbase: boolean
  /** Previous output value when known (Esplora/mempool JSON). */
  value?: number
  /** Previous output address when known (Esplora/mempool JSON). */
  address?: string
}

export type ExplorerTxOutput = {
  index: number
  value: number
  script: string
  /** Output address when known (Esplora/mempool JSON). */
  address?: string
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
  /** Raw transaction hex when available (for colored decode view). */
  hex?: string
}
