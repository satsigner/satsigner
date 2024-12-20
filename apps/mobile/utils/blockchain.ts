import {
  Block,
  BlockchainOracle,
  BlockStatus,
  Currency,
  DifficultyAdjustment,
  MemPool,
  MemPoolBlock,
  MemPoolFees,
  Tx,
  TxOutspends,
  TxPriority,
  TxStatus
} from '@/types/models/Blockchain'

export class MemPoolOracle implements BlockchainOracle {
  baseUrl: string
  constructor(baseUrl = 'https://mempool.space/api') {
    this.baseUrl = baseUrl
  }
  async get(endpoint: string) {
    return fetch(this.baseUrl + endpoint).then((response: any) =>
      response.json()
    )
  }
  async getText(endpoint: string) {
    return fetch(this.baseUrl + endpoint).then((response: any) =>
      response.text()
    )
  }
  async getBlock(blkid: string): Promise<Block> {
    const data = await this.get(`/block/${blkid}`)
    return data as Block
  }
  async getBlockAt(timestamp: number): Promise<Block> {
    const data: any = await this.get(`/v1/mining/blocks/timestamp/${timestamp}`)
    const blockId = data.hash
    const block = await this.getBlock(blockId)
    return block
  }
  async getBlockStatus(blkid: string): Promise<BlockStatus> {
    const data: any = await this.get(`/block/${blkid}/status`)
    return data as BlockStatus
  }
  async getBlockTransactions(blkid: string): Promise<Tx[]> {
    const data: any = await this.get(`/block/${blkid}/txs`)
    return data as Tx[]
  }
  async getCurrentBlockHeight(): Promise<number> {
    return this.getText(`/blocks/tip/height`).then((height: string) =>
      Number(height)
    )
  }
  async getCurrentBlockHash(): Promise<string> {
    return this.getText(`/blocks/tip/hash`)
  }
  async getCurrentFeeRate(priority: TxPriority): Promise<number> {
    const feeRates: MemPoolFees = await this.getMemPoolFees()
    return feeRates[priority]
  }
  async getCurrentDifficulty(): Promise<number> {
    const data: any = await this.get(`/v1/mining/hashrate/1d`)
    return data.currentDifficulty as number
  }
  async getCurrentHashRate(): Promise<number> {
    const data: any = await this.get(`/v1/mining/hashrate/1d`)
    return data.currentHashrate as number
  }
  async getDifficultyAdjustment(): Promise<DifficultyAdjustment> {
    const data: any = await this.get(`/v1/difficulty-adjustment`)
    return data as DifficultyAdjustment
  }
  async getMemPool(): Promise<MemPool> {
    const data: any = await this.get(`/mempool`)
    return data as MemPool
  }
  async getMemPoolFees(): Promise<MemPoolFees> {
    const data = await this.get(`/v1/fees/recommended`)
    const fees: MemPoolFees = {
      none: data.minimumFee,
      low: data.economyFee,
      medium: data.hourFee,
      high: data.fastestFee
    }
    return fees
  }
  async getMemPoolBlocks(): Promise<MemPoolBlock[]> {
    const data: any = await this.get(`/v1/fees/mempool-blocks`)
    return data as MemPoolBlock[]
  }
  async getPriceAt(currency: string, timestamp: number): Promise<number> {
    const data: any = await this.get(
      `/v1/historical-price?currency=${currency}&timestamp=${timestamp}`
    )
    const prices = data.prices
    return prices[0][currency] as number
  }
  async getPrice(currency: Currency): Promise<number> {
    const data: any = await this.get(`/v1/prices`)
    return data[currency] as number
  }
  async getTransaction(txid: string): Promise<Tx> {
    const data: any = await this.get(`/tx/${txid}`)
    return data as Tx
  }
  async getTransactionHex(txid: string): Promise<string> {
    const data: string = await this.getText(`/tx/${txid}`)
    return data
  }
  async getTransactionOutspends(txid: string): Promise<TxOutspends> {
    const data: any = await this.getText(`/tx/${txid}/outspends`)
    return data as TxOutspends
  }
  async getTransactionStatus(txid: string): Promise<TxStatus> {
    const data: any = await this.getText(`/tx/${txid}/status`)
    return data as TxStatus
  }
}
