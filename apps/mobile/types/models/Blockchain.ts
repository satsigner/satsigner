import z from 'zod'

export interface BlockchainOracle {
  getAddressUtxos: (address: string) => Promise<UTXO[]>
  getBlock: (blkid: string) => Promise<Block>
  getBlockAt: (timestamp: number) => Promise<Block>
  getBlockAtHeight: (height: number) => Promise<Block>
  getBlockStatus: (blkid: string) => Promise<BlockStatus>
  getBlockTransactions: (blkid: string) => Promise<Tx[]>
  getCurrentBlockHash: () => Promise<string>
  getCurrentBlockHeight: () => Promise<number>
  getCurrentDifficulty: () => Promise<number>
  getCurrentFeeRate: (priority: TxPriority) => Promise<Satoshi>
  getCurrentHashRate: () => Promise<number>
  getDifficultyAdjustment: () => Promise<DifficultyAdjustment>
  getMemPool: () => Promise<MemPool>
  getMemPoolBlocks: () => Promise<MemPoolBlock[]>
  getMemPoolFees: () => Promise<MemPoolFees>
  getPrice: (currency: Currency) => Promise<number>
  getPrices: () => Promise<Prices>
  getPriceAt: (currency: Currency, timestamp: number) => Promise<number>
  getFullPriceAt: (
    currency: Currency,
    timestamp: number
  ) => Promise<Record<string, number>>
  getPricesAddress: (
    currency: Currency,
    address: string
  ) => Promise<PriceValue[]>
  getPricesTxOuputs: (currency: Currency, txid: string) => Promise<PriceValue[]>
  getPricesTxInputs: (currency: Currency, txid: string) => Promise<PriceValue[]>
  getTransaction: (txid: string) => Promise<Tx>
  getTransactionHex: (txid: string) => Promise<string>
  getTransactionOutspends: (txid: string) => Promise<TxOutspend[]>
  getTransactionStatus: (txid: string) => Promise<TxStatus>
}

export const SatoshiSchema = z.number()

export const CurrencySchema = z.enum([
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'CHF',
  'AUD',
  'JPY'
])

export const PriceValueSchema = z.object({
  currency: CurrencySchema,
  fiatPrice: z.number(),
  fiatValue: z.number(),
  value: z.number()
})

export const PricesSchema = z.object({
  AUD: z.number().optional(),
  CAD: z.number().optional(),
  CHF: z.number().optional(),
  EUR: z.number().optional(),
  GBP: z.number().optional(),
  JPY: z.number().optional(),
  USD: z.number().optional()
})

export const BlockStatusSchema = z.object({
  height: z.number(),
  in_best_chain: z.boolean()
})

export const BlockSchema = z.object({
  bits: z.number().optional(),
  difficulty: z.number(),
  height: z.number(),
  id: z.string(),
  mediantime: z.number(),
  merkle_root: z.string(),
  nonce: z.number(),
  previousblockhash: z.string(),
  size: z.number(),
  timestamp: z.number(),
  tx_count: z.number(),
  version: z.number(),
  weight: z.number()
})

export const BlockDifficultySchema = z.object({
  chainWork: z.string(),
  cycleHeight: z.number(),
  height: z.number(),
  nonce: z.number(),
  size: z.number(),
  timeDifference: z.number(),
  timestamp: z.number(),
  txCount: z.number(),
  weight: z.number()
})

export const TxPrioritySchema = z.enum(['none', 'low', 'medium', 'high'])

export const TxOutSchema = z.object({
  scriptpubkey: z.string().optional(),
  scriptpubkey_address: z.string().optional(),
  scriptpubkey_asm: z.string().optional(),
  scriptpubkey_type: z.string().optional(),
  value: SatoshiSchema
})

export const TxInSchema = z.object({
  is_coinbase: z.boolean(),
  prevout: TxOutSchema,
  scriptsig: z.string(),
  scriptsig_asm: z.string(),
  sequence: z.number(),
  txid: z.string(),
  vout: z.number()
})

export const TxStatusSchema = z.object({
  block_hash: z.string(),
  block_height: z.number(),
  block_time: z.number(),
  confirmed: z.boolean()
})

export const TxOutspendSchema = z.object({
  spent: z.boolean(),
  status: TxStatusSchema,
  txid: z.string(),
  vin: z.number()
})

export const TxSchema = z.object({
  fee: SatoshiSchema,
  locktime: z.number(),
  size: z.number(),
  status: TxStatusSchema,
  txid: z.string(),
  version: z.number(),
  vin: z.array(TxInSchema),
  vout: z.array(TxOutSchema),
  weight: z.number()
})

export const UTXOSchema = z.object({
  status: TxStatusSchema,
  txid: z.string(),
  value: z.number(),
  vout: z.number()
})

export const MemPoolSchema = z.object({
  count: z.number(),
  fee_histogram: z.array(z.tuple([z.number(), z.number()])),
  total_fee: z.number(),
  vsize: z.number()
})

export const MemPoolFeesSchema = z
  .record(TxPrioritySchema, SatoshiSchema)
  .optional()

export const MemPoolBlockSchema = z.object({
  blockSize: z.number(),
  blockVSize: z.number(),
  feeRange: z.array(z.number()),
  medianFee: z.number(),
  nTx: z.number(),
  totalFees: z.number()
})

export const DifficultyAdjustmentSchema = z.object({
  adjustedTimeAvg: z.number(),
  difficultyChange: z.number(),
  estimatedRetargetDate: z.number(),
  nextRetargetHeight: z.number(),
  previousRetarget: z.number(),
  progressPercent: z.number(),
  remainingBlocks: z.number(),
  remainingTime: z.number(),
  timeAvg: z.number(),
  timeOffset: z.number()
})

export const BlockFeeRatesSchema = z.object({
  avgFee_0: z.number(),
  avgFee_10: z.number(),
  avgFee_100: z.number(),
  avgFee_25: z.number(),
  avgFee_50: z.number(),
  avgFee_75: z.number(),
  avgFee_90: z.number(),
  avgHeight: z.number(),
  timestamp: z.number()
})

export const MempoolStatisticsSchema = z.object({
  added: z.number(),
  count: z.number(),
  mempool_byte_weight: z.number(),
  min_fee: z.number(),
  total_fee: z.number(),
  vbytes_per_second: z.number(),
  vsizes: z.array(z.number())
})

export type Satoshi = z.infer<typeof SatoshiSchema>
export type PriceValue = z.infer<typeof PriceValueSchema>
export type Currency = z.infer<typeof CurrencySchema>
export type Prices = z.infer<typeof PricesSchema>
export type BlockStatus = z.infer<typeof BlockStatusSchema>
export type Block = z.infer<typeof BlockSchema>
export type BlockDifficulty = z.infer<typeof BlockDifficultySchema>
export type TxPriority = z.infer<typeof TxPrioritySchema>
export type Tx = z.infer<typeof TxSchema>
export type TxOut = z.infer<typeof TxOutSchema>
export type TxIn = z.infer<typeof TxInSchema>
export type TxStatus = z.infer<typeof TxStatusSchema>
export type TxOutspend = z.infer<typeof TxOutspendSchema>
export type UTXO = z.infer<typeof UTXOSchema>
export type MemPool = z.infer<typeof MemPoolSchema>
export type MemPoolFees = z.infer<typeof MemPoolFeesSchema>
export type MemPoolBlock = z.infer<typeof MemPoolBlockSchema>
export type DifficultyAdjustment = z.infer<typeof DifficultyAdjustmentSchema>
export type BlockFeeRates = z.infer<typeof BlockFeeRatesSchema>
export type MempoolStatistics = z.infer<typeof MempoolStatisticsSchema>
