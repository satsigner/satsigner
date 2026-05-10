import z from 'zod'

import { SATS_PER_BITCOIN } from '@/constants/btc'
import {
  BlockFeeRatesSchema,
  BlockSchema,
  BlockStatusSchema,
  DifficultyAdjustmentSchema,
  MemPoolBlockSchema,
  MemPoolSchema,
  MempoolStatisticsSchema,
  PricesSchema,
  TxOutspendSchema,
  TxSchema,
  TxStatusSchema,
  UTXOSchema,
  type BlockchainOracle,
  type Currency,
  type MemPoolFees,
  type PriceValue,
  type TxPriority
} from '@/types/models/Blockchain'

const satoshiToFiat = (btcFiatPrice: number, sats: number, decimals = 2) =>
  Number(((btcFiatPrice * sats) / SATS_PER_BITCOIN).toFixed(decimals))

export class MempoolOracle implements BlockchainOracle {
  baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  get(endpoint: string) {
    return fetch(this.baseUrl + endpoint).then(
      (response: Response) => response.json() as Promise<unknown>
    )
  }

  getText(endpoint: string): Promise<string> {
    return fetch(this.baseUrl + endpoint).then(
      (response: Response) => response.text() as Promise<string>
    )
  }

  getBinary(endpoint: string): Promise<ArrayBuffer> {
    return fetch(this.baseUrl + endpoint).then(
      (response: Response) => response.arrayBuffer() as Promise<ArrayBuffer>
    )
  }

  async getAddressUtxos(address: string) {
    const data = await this.get(`/address/${address}/utxo`)
    return z.array(UTXOSchema).parse(data)
  }

  async getBlock(blkid: string) {
    const data = await this.get(`/block/${blkid}`)
    return BlockSchema.parse(data)
  }

  async getBlockRaw(blkid: string): Promise<ArrayBuffer> {
    const data: ArrayBuffer = await this.getBinary(`/block/${blkid}/raw`)
    return data
  }

  async getBlockAtHeight(height: number) {
    const data = await this.getText(`/block-height/${height}`)
    const blockHash = z.string().parse(data)
    return this.getBlock(blockHash)
  }

  async getBlockAt(timestamp: number) {
    const data = (await this.get(
      `/v1/mining/blocks/timestamp/${timestamp}`
    )) as { hash: string }
    const blockId = data.hash
    const block = await this.getBlock(blockId)
    return block
  }

  async getBlockStatus(blkid: string) {
    const data = await this.get(`/block/${blkid}/status`)
    return BlockStatusSchema.parse(data)
  }

  async getBlockTransactions(blkid: string) {
    const data = await this.get(`/block/${blkid}/txs`)
    return z.array(TxSchema).parse(data)
  }

  async getBlockTransactionIds(blkid: string) {
    const data = await this.get(`/block/${blkid}/txids`)
    return z.array(TxSchema.shape.txid).parse(data)
  }

  async getCurrentBlockHeight() {
    const data = await this.getText(`/blocks/tip/height`)
    return z.number().parse(data)
  }

  async getCurrentBlockHash() {
    const data = await this.getText(`/blocks/tip/hash`)
    return z.string().parse(data)
  }

  async getCurrentFeeRate(priority: TxPriority) {
    const feeRates = await this.getMemPoolFees()
    const rate = feeRates[priority]
    if (rate !== undefined) {
      return rate
    }
    throw new Error('unvailable rate')
  }

  async getBlockFeeRates(period: string) {
    const data = await this.get(`/v1/mining/blocks/fee-rates/${period}`)
    return BlockFeeRatesSchema.parse(data)
  }

  async getMempoolStatistics(period: string) {
    const data = await this.get(`/v1/statistics/${period}`)
    return z.array(MempoolStatisticsSchema).parse(data)
  }

  async getCurrentDifficulty() {
    const data = await this.get(`/v1/mining/hashrate/1d`)
    const difficulty = z
      .object({
        currentDifficulty: z.number()
      })
      .parse(data)
    return difficulty.currentDifficulty
  }

  async getCurrentHashRate() {
    const data = await this.get(`/v1/mining/hashrate/1d`)
    const hashRate = z
      .object({
        currentHashrate: z.number()
      })
      .parse(data)
    return hashRate.currentHashrate
  }

  async getDifficultyAdjustment() {
    const data = await this.get(`/v1/difficulty-adjustment`)
    return DifficultyAdjustmentSchema.parse(data)
  }

  async getMemPool() {
    const data = await this.get(`/mempool`)
    return MemPoolSchema.parse(data)
  }

  async getMemPoolFees() {
    const data = await this.get(`/v1/fees/recommended`)
    const feesObj = z
      .object({
        economyFee: z.number(),
        fastestFee: z.number(),
        hourFee: z.number(),
        minimumFee: z.number()
      })
      .parse(data)
    const fees: MemPoolFees = {
      high: feesObj.fastestFee,
      low: feesObj.economyFee,
      medium: feesObj.hourFee,
      none: feesObj.minimumFee
    }
    return fees
  }

  async getMemPoolBlocks() {
    const data = await this.get(`/v1/fees/mempool-blocks`)
    return z.array(MemPoolBlockSchema).parse(data)
  }

  async getPrices() {
    const data = await this.get('/v1/prices')
    return z.nonoptional(PricesSchema).parse(data)
  }

  async getPrice(currency: Currency) {
    const prices = await this.getPrices()
    if (prices[currency] === undefined) {
      throw new Error(
        `ERROR: Unavailable price for ${currency} (Server url = ${this.baseUrl})`
      )
    }
    return prices[currency]
  }

  async getPriceAt(currency: string, timestamp: number) {
    const data = (await this.get(
      `/v1/historical-price?currency=${currency}&timestamp=${timestamp}`
    )) as { prices: Record<string, number>[] }
    const { prices } = data
    return prices[0][currency] as number
  }

  async getFullPriceAt(currency: Currency, timestamp: number) {
    const HistoricalPricesSchema = z.object({
      exchangeRates: z.record(z.string(), z.number()),
      prices: z.array(PricesSchema)
    })
    const data = await this.get(
      `/v1/historical-price?currency=${currency}&timestamp=${timestamp}`
    )
    const { prices, exchangeRates } = HistoricalPricesSchema.parse(data)

    if (prices.length === 0 || prices[0][currency] === undefined) {
      throw new Error(
        `ERROR: Unavailable price for ${currency} at ${timestamp} (Server url = ${this.baseUrl})`
      )
    }

    const btcPrice = prices[0][currency]
    const pricesEntries: Record<string, number> = Object.fromEntries(
      Object.entries(exchangeRates)
        .map(([key, rate]) => {
          const currencyCode = key.replace('USD', '')
          return [currencyCode, btcPrice * Number(rate)]
        })
        .concat([['USD', btcPrice]])
    )
    return pricesEntries
  }

  async getPricesAt(currency: string, timestamps: number[]) {
    const uniqueTimestamps = [...new Set(timestamps)]
    const time2price: Record<string, number> = {}
    for (const time of uniqueTimestamps) {
      const price = await this.getPriceAt(currency, time)
      time2price[time] = price
    }
    const prices = timestamps.map((time) => time2price[time])
    return prices
  }

  async getPricesAddress(currency: Currency, address: string) {
    const utxos = await this.getAddressUtxos(address)
    const timestamps = utxos.map((u) => u.status.block_time)
    const fiatPrices = await this.getPricesAt(currency, timestamps)
    const priceValues: PriceValue[] = []
    for (let i = 0; i < fiatPrices.length; i += 1) {
      const fiatPrice = fiatPrices[i]
      const { value } = utxos[i]
      const fiatValue = satoshiToFiat(fiatPrice, value)
      priceValues.push({ currency, fiatPrice, fiatValue, value })
    }
    return priceValues
  }

  async getPricesTxInputs(currency: Currency, txid: string) {
    const tx = await this.getTransaction(txid)
    const timestamp = tx.status.block_time
    const fiatPrice = await this.getPriceAt(currency, timestamp)
    const priceValues: PriceValue[] = []
    for (const vin of tx.vin) {
      const { value } = vin.prevout
      const fiatValue = satoshiToFiat(fiatPrice, value)
      priceValues.push({ currency, fiatPrice, fiatValue, value })
    }
    return priceValues
  }

  async getPricesTxOuputs(
    currency: Currency,
    txid: string
  ): Promise<PriceValue[]> {
    const tx = await this.getTransaction(txid)
    const timestamp = tx.status.block_time
    const fiatPrice = await this.getPriceAt(currency, timestamp)
    const priceValues: PriceValue[] = []
    for (const vOut of tx.vout) {
      const { value } = vOut
      const fiatValue = satoshiToFiat(fiatPrice, value)
      priceValues.push({ currency, fiatPrice, fiatValue, value })
    }
    return priceValues
  }

  async getTransaction(txid: string) {
    const data = await this.get(`/tx/${txid}`)
    return TxSchema.parse(data)
  }

  async getTransactionHex(txid: string) {
    const data = await this.getText(`/tx/${txid}`)
    return z.string().parse(data)
  }

  async getTransactionOutspends(txid: string) {
    const data = await this.get(`/tx/${txid}/outspends`)
    return z.array(TxOutspendSchema).parse(data)
  }

  async getTransactionStatus(txid: string) {
    const data = await this.get(`/tx/${txid}/status`)
    return TxStatusSchema.parse(data)
  }
}
