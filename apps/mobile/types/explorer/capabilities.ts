export const EXPLORER_FEATURES = [
  'addressHistory',
  'blockTxList',
  'difficultyAdjustment',
  'feeEstimates',
  'mempoolStats',
  'rawBlock',
  'txLookup'
] as const

export type ExplorerFeature = (typeof EXPLORER_FEATURES)[number]

export type ExplorerCapabilityResult = {
  available: boolean
  whyKey: string | null
  fixKey: string | null
}

export type ExplorerDataSource = 'backend' | 'mempool' | 'bitnodes' | 'pvxg'
