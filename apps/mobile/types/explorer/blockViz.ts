export type ExplorerBlockPool = {
  id: number | null
  name: string | null
  slug: string | null
}

export type ExplorerBlockExtras = {
  avgFee: number | null
  avgFeeRate: number | null
  avgTxSize: number | null
  feeRange: number[]
  matchRate: number | null
  medianFee: number | null
  pool: ExplorerBlockPool | null
  reward: number | null
  segwitTotalTxs: number | null
  totalFees: number | null
  totalInputs: number | null
  totalOutputs: number | null
  virtualSize: number | null
}

export type ExplorerBlockVizSampleTx = {
  feeRate: number
  txid: string
  weight: number
}

export type ExplorerBlockVizData = {
  extras: ExplorerBlockExtras
  height: number
  id: string
  sampleTxs: ExplorerBlockVizSampleTx[]
  source: 'mempool'
  txCount: number
}
