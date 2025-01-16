export interface BlockchainOracle {
  getAddressUtxos: (address: string) => Promise<UTXO[]>
  getBlock: (blkid: string) => Promise<Block>
  getBlockAt: (timestamp: number) => Promise<Block>
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

export type Satoshi = number

export type PriceValue = {
  currency: Currency
  fiatPrice: number
  fiatValue: number
  value: number
}

export type Currency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'CAD'
  | 'BRL'
  | 'CHN'
  | 'AUD'
  | 'JPY'

export type Prices = {
  [key in Currency]: number
}

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

export enum TxPriority {
  none = 'none',
  low = 'low',
  medium = 'medium',
  high = 'high'
}

export type Tx = {
  txid: string
  version: number
  locktime: number
  vin: TxIn[]
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

export type TxIn = {
  txid: string
  vout: number
  scriptsig: string
  scriptsig_asm: string
  sequence: number
  is_coinbase: boolean
  prevout: TxOut
}

export type TxStatus = {
  confirmed: boolean
  block_height: number
  block_hash: string
  block_time: number
}

export type TxOutspend = {
  spent: boolean
  txid: string
  vin: number
  status: TxStatus
}

export type UTXO = {
  txid: string
  vout: number
  value: number
  status: TxStatus
}

export type MemPool = {
  count: number
  vsize: number
  total_fee: number
  fee_histogram: [number, number][]
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

export type DifficultyAdjustment = {
  difficultyChange: number
  progressPercent: number
  remainingBlocks: number
  remainingTime: number
  nextRetargetHeight: number
}

export type HashRateInfo = {
  hashrate: {
    timestamp: number
    avgHashRate: number
  }[]
  difficulty: {
    timestamp: number
    difficulty: number
    height: number
  }[]
  currentHashRate: number
  currentDifficulty: number
}
