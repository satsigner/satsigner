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
  TxOutspend,
  TxPriority,
  TxStatus
} from '@/types/models/Blockchain'

export class MempoolOracle implements BlockchainOracle {
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
    const height = await this.getText(`/blocks/tip/height`)
    return Number(height)
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
  async getPrice(currency: Currency): Promise<number> {
    const data: any = await this.get(`/v1/prices`)
    return data[currency] as number
  }
  async getPriceAt(currency: string, timestamp: number): Promise<number> {
    const data: any = await this.get(
      `/v1/historical-price?currency=${currency}&timestamp=${timestamp}`
    )
    const prices = data.prices
    return prices[0][currency] as number
  }
  async getPricesAt(currency: string, timestamps: number[]): Promise<number[]> {
    // create a set of unique timestamps to avoid duplicate requests
    const uniqueTimestamps = [...new Set(timestamps)]
    // build a map to track time->price
    const time2price = {} as { [key: string]: number }
    // make requests without duplicates
    for (const time of uniqueTimestamps) {
      const price = await this.getPriceAt(currency, time)
      time2price[time] = price
    }
    // build the price array
    const prices: number[] = []
    for (const time of timestamps) prices.push(time2price[time])
    return prices
  }
  async getPricesAddress(currency: string, address: string): Promise<number[]> {
    const utxos: TxOutspend[] = await this.get(`/${address}/utxo`)
    const timestamps = utxos.map((o: TxOutspend) => o.status.block_height)
    return this.getPricesAt(currency, timestamps)
  }
  async getPricesTx(currency: string, txid: string): Promise<number[]> {
    const outspends: TxOutspend[] = await this.getTransactionOutspends(txid)
    const timestamps = outspends.map((o: TxOutspend) => o.status.block_height)
    return this.getPricesAt(currency, timestamps)
  }
  async getPriceUtxo(
    currency: string,
    txid: string,
    vout: string
  ): Promise<number> {
    const data: TxOutspend = await this.get(`/tx/${txid}/outspend/${vout}`)
    const timestamp = data.status.block_time
    return this.getPriceAt(currency, timestamp)
  }
  async getTransaction(txid: string): Promise<Tx> {
    const data: any = await this.get(`/tx/${txid}`)
    return data as Tx
  }
  async getTransactionHex(txid: string): Promise<string> {
    const data: string = await this.getText(`/tx/${txid}`)
    return data
  }
  async getTransactionOutspends(txid: string): Promise<TxOutspend[]> {
    const data: any = await this.getText(`/tx/${txid}/outspends`)
    return data as TxOutspend[]
  }
  async getTransactionStatus(txid: string): Promise<TxStatus> {
    const data: any = await this.getText(`/tx/${txid}/status`)
    return data as TxStatus
  }
}
