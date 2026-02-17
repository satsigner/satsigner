import { SATS_PER_BITCOIN } from '@/constants/btc'
import type {
  Block,
  BlockchainOracle,
  BlockFeeRates,
  BlockStatus,
  Currency,
  DifficultyAdjustment,
  MemPool,
  MemPoolBlock,
  MemPoolFees,
  MempoolStatistics,
  Prices,
  PriceValue,
  Tx,
  TxOutspend,
  TxPriority,
  TxStatus,
  UTXO
} from '@/types/models/Blockchain'
import type { NonPartial } from '@/types/utils'

const satoshiToFiat = (btcFiatPrice: number, sats: number, decimals = 2) =>
  Number(((btcFiatPrice * sats) / SATS_PER_BITCOIN).toFixed(decimals))

export class MempoolOracle implements BlockchainOracle {
  baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async get(endpoint: string) {
    return fetch(this.baseUrl + endpoint).then((response: any) => {
      return response.json() as any
    })
  }

  async getText(endpoint: string): Promise<string> {
    return fetch(this.baseUrl + endpoint).then((response: any) => {
      return response.text() as string
    })
  }

  async getBinary(endpoint: string): Promise<ArrayBuffer> {
    return fetch(this.baseUrl + endpoint).then((response: any) => {
      return response.arrayBuffer() as ArrayBuffer
    })
  }

  async getAddressUtxos(address: string): Promise<UTXO[]> {
    const data: UTXO[] = await this.get(`/address/${address}/utxo`)
    return data
  }

  async getBlock(blkid: string): Promise<Block> {
    const data: Block = await this.get(`/block/${blkid}`)
    return data
  }

  async getBlockRaw(blkid: string): Promise<ArrayBuffer> {
    const data: ArrayBuffer = await this.getBinary(`/block/${blkid}/raw`)
    return data
  }

  async getBlockAtHeight(height: number): Promise<Block> {
    const blockHash = await this.getText(`/block-height/${height}`)
    return this.getBlock(blockHash)
  }

  async getBlockAt(timestamp: number): Promise<Block> {
    const data: any = await this.get(`/v1/mining/blocks/timestamp/${timestamp}`)
    const blockId = data.hash
    const block = await this.getBlock(blockId)
    return block
  }

  async getBlockStatus(blkid: string): Promise<BlockStatus> {
    const data: BlockStatus = await this.get(`/block/${blkid}/status`)
    return data
  }

  async getBlockTransactions(blkid: string): Promise<Tx[]> {
    const data: Tx[] = await this.get(`/block/${blkid}/txs`)
    return data
  }

  async getBlockTransactionIds(blkid: string): Promise<Tx['txid'][]> {
    const data: Tx['txid'][] = await this.get(`/block/${blkid}/txids`)
    return data
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

  async getBlockFeeRates(period: string): Promise<BlockFeeRates> {
    const data: BlockFeeRates = await this.get(
      `/v1/mining/blocks/fee-rates/${period}`
    )
    return data
  }

  async getMempoolStatistics(period: string): Promise<MempoolStatistics[]> {
    const data: MempoolStatistics[] = await this.get(`/v1/statistics/${period}`)
    return data
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
    const data: DifficultyAdjustment = await this.get(
      `/v1/difficulty-adjustment`
    )
    return data
  }

  async getMemPool(): Promise<MemPool> {
    const data: MemPool = await this.get(`/mempool`)
    return data
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
    const data: MemPoolBlock[] = await this.get(`/v1/fees/mempool-blocks`)
    return data
  }

  async getPrices(): Promise<NonPartial<Prices>> {
    const data: NonPartial<Prices> = await this.get(`/v1/prices`)
    return data
  }

  async getPrice(currency: Currency): Promise<number> {
    const data: NonPartial<Prices> = await this.getPrices()
    return data[currency] as number
  }

  async getPriceAt(currency: string, timestamp: number): Promise<number> {
    const data: any = await this.get(
      `/v1/historical-price?currency=${currency}&timestamp=${timestamp}`
    )
    const prices = data.prices
    return prices[0][currency] as number
  }

  async getFullPriceAt(
    currency: string,
    timestamp: number
  ): Promise<Record<string, number>> {
    const { prices, exchangeRates }: any = await this.get(
      `/v1/historical-price?currency=${currency}&timestamp=${timestamp}`
    )

    const btcPrice = prices[0][currency]

    return Object.fromEntries(
      Object.entries(exchangeRates)
        .map(([key, rate]) => {
          const currencyCode = key.replace('USD', '')
          return [currencyCode, btcPrice * Number(rate)]
        })
        .concat([['USD', btcPrice]])
    )
  }

  async getPricesAt(currency: string, timestamps: number[]): Promise<number[]> {
    const uniqueTimestamps = [...new Set(timestamps)]
    const time2price: Record<string, number> = {}
    for (const time of uniqueTimestamps) {
      const price = await this.getPriceAt(currency, time)
      time2price[time] = price
    }
    const prices = timestamps.map((time) => time2price[time])
    return prices
  }

  async getPricesAddress(
    currency: Currency,
    address: string
  ): Promise<PriceValue[]> {
    const utxos = await this.getAddressUtxos(address)
    const timestamps = utxos.map((o: UTXO) => o.status.block_time)
    const fiatPrices = await this.getPricesAt(currency, timestamps)
    const priceValues: PriceValue[] = []
    for (let i = 0; i < fiatPrices.length; i++) {
      const fiatPrice = fiatPrices[i]
      const value = utxos[i].value
      const fiatValue = satoshiToFiat(fiatPrice, value)
      priceValues.push({ currency, value, fiatValue, fiatPrice })
    }
    return priceValues
  }

  async getPricesTxInputs(
    currency: Currency,
    txid: string
  ): Promise<PriceValue[]> {
    const tx: Tx = await this.getTransaction(txid)
    const timestamp = tx.status.block_time
    const fiatPrice = await this.getPriceAt(currency, timestamp)
    const priceValues: PriceValue[] = []
    for (const vin of tx.vin) {
      const value = vin.prevout.value
      const fiatValue = satoshiToFiat(fiatPrice, value)
      priceValues.push({ currency, fiatPrice, value, fiatValue })
    }
    return priceValues
  }

  async getPricesTxOuputs(
    currency: Currency,
    txid: string
  ): Promise<PriceValue[]> {
    const tx: Tx = await this.getTransaction(txid)
    const timestamp = tx.status.block_time
    const fiatPrice = await this.getPriceAt(currency, timestamp)
    const priceValues: PriceValue[] = []
    for (const vOut of tx.vout) {
      const value = vOut.value
      const fiatValue = satoshiToFiat(fiatPrice, value)
      priceValues.push({ currency, fiatPrice, value, fiatValue })
    }
    return priceValues
  }

  async getTransaction(txid: string): Promise<Tx> {
    const data: Tx = await this.get(`/tx/${txid}`)
    return data
  }

  async getTransactionHex(txid: string): Promise<string> {
    const data: string = await this.getText(`/tx/${txid}`)
    return data
  }

  async getTransactionOutspends(txid: string): Promise<TxOutspend[]> {
    const data: TxOutspend[] = await this.get(`/tx/${txid}/outspends`)
    return data
  }

  async getTransactionStatus(txid: string): Promise<TxStatus> {
    const data: TxStatus = await this.get(`/tx/${txid}/status`)
    return data
  }
}
