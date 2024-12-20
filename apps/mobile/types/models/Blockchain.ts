// ── blockchain oracle ───────────────────────────────────────────────

export interface BlockchainOracle {
  getBlock: (blkid: string) => Promise<Block>
  getBlockAt: (timestamp: number) => Promise<Block>
  getBlockStatus: (blkid: string) => Promise<BlockStatus>
  getBlockTransactions: (blkid: string) => Promise<Tx[]>
  getCurrentBlockHeight: () => Promise<number>
  getCurrentBlockHash: () => Promise<string>
  getCurrentFeeRate: (priority: TxPriority) => Promise<Satoshi>
  getCurrentDifficulty: () => Promise<number>
  getCurrentHashRate: () => Promise<number>
  getDifficultyAdjustment: () => Promise<DifficultyAdjustment>
  getMemPool: () => Promise<MemPool>
  getMemPoolFees: () => Promise<MemPoolFees>
  getMemPoolBlocks: () => Promise<MemPoolBlock[]>
  getPriceAt: (currency: string, timestamp: number) => Promise<Satoshi>
  getPrice: (currency: Currency) => Promise<Satoshi>
  getTransaction: (txid: string) => Promise<Tx>
  getTransactionHex: (txid: string) => Promise<string>
  getTransactionOutspends: (txid: string) => Promise<TxOutspends>
  getTransactionStatus: (txid: string) => Promise<TxStatus>
}

// ── currencies ──────────────────────────────────────────────────────

export type Satoshi = number

export type Currency = "USD" | "EUR" | "GBP"| "CAD" | "BRL" | "CHN" | "AUD" | "JPY"

// ── blocks ──────────────────────────────────────────────────────────

export type BlockStatus = {
  height: number
  in_best_chain: boolean
}

export type Block = {
  id: string
  height: number
  size: number
  weight: number
  difficulty: number
  tx_count: number
  timestamp: number
  previousblockhash: string
}

// ── transactions ────────────────────────────────────────────────────

export enum TxPriority {
  none = "none",
  low = "low",
  medium = "medium",
  high = "high",
}

export type Tx = {
  txid: string
  version: number
  locktime: number
  vin: TxInput[]
  vout: TxOut[]
  fee: Satoshi
  weight: number
  size: number
  status: TxStatus
}

export type TxOut = {
  value: Satoshi
  scriptpubkey?: string
  scriptpubkey_asm?: string
  scriptpubkey_type?: string
  scriptpubkey_address?: string
}

export type TxInput = {
  txid: string
  vout: number
  scriptsig: string
  scriptsig_asm: string
  sequence: number
  is_coinbase: boolean
}

export type TxStatus = {
  confirmed: boolean
  block_height: number
  block_hash: string
  block_time: number
}

export type TxOutspends = {
  spent: boolean
  txid: string
  vin: number
  status: TxStatus
}

// ── mempool ─────────────────────────────────────────────────────────

export type MemPool = {
  count: number
  vsize: number
  total_fee: number
  fee_histogram: Array<[number, number]>
}

export type MemPoolFees = {
  [key in TxPriority]: Satoshi
}

export type MemPoolBlock = {
  blockSize: number
  blockVSize: number
  nTx: number
  totalFees: number
  medianFee: number
  feeRange: number[]
}

// ── hashrate ────────────────────────────────────────────────────────

export type DifficultyAdjustment = {
  difficultyChange: number
  progressPercent: number
  remainingBlocks: number
  remainingTime: number
  nextRetargetHeight: number
}

export type HashRateInfo = {
  hashrate: {
    timestamp: number,
    avgHashRate: number
  }[]
  difficulty: {
    timestamp: number,
    difficulty: number,
    height: number
  }[]
  currentHashRate: number,
  currentDifficulty: number,
}
