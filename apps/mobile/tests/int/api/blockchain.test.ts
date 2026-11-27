import { MempoolOracle } from '@/api/blockchain'
import type {
  BlockchainOracle,
  MemPoolFees,
  PriceValue
} from '@/types/models/Blockchain'
import { TxPrioritySchema } from '@/types/models/Blockchain'

// BTC traded between roughly 1800 and 2900 (USD and EUR) in July 2017.
const MIN_JULY_2017_PRICE = 1500
const MAX_JULY_2017_PRICE = 3000

const mempoolspace: BlockchainOracle = new MempoolOracle(
  'https://mempool.space/api'
)

describe('blockchain » price', () => {
  it('get price at given currency', async () => {
    const response = await mempoolspace.getPrice('CAD')
    expect(typeof response).toBe('number')
  })

  // mempool.space revises its historical prices, so these check the shape and
  // a plausible range rather than an exact value.
  it('get price at given currency at given time', async () => {
    const timestamp = 1_500_000_000
    const response = await mempoolspace.getPriceAt('EUR', timestamp)
    expect(response).toBeGreaterThan(MIN_JULY_2017_PRICE)
    expect(response).toBeLessThan(MAX_JULY_2017_PRICE)
  })

  it('get prices list at given time', async () => {
    const timestamp = 1_500_000_000
    const response = await mempoolspace.getFullPriceAt('USD', timestamp)
    expect(typeof response).toBe('object')
    expect(typeof response['USD']).toBe('number')
    expect(response['USD']).toBeGreaterThan(MIN_JULY_2017_PRICE)
    expect(response['USD']).toBeLessThan(MAX_JULY_2017_PRICE)
  })
})

describe('blockchain » mempool', () => {
  const errorTolerance = 0.015 // 1.5%
  const isDiffReasonable = (a: number, b: number) =>
    Math.abs((a - b) / b) < errorTolerance

  it('get mempool info', async () => {
    const response = await mempoolspace.getMemPool()
    expect(typeof response.count).toBe('number')
    expect(typeof response.total_fee).toBe('number')
    expect(Array.isArray(response.fee_histogram)).toBeTruthy()
    expect(response.fee_histogram.length).toBeGreaterThan(1)
    expect(response.fee_histogram[0]).toHaveLength(2)
    expect(typeof response.fee_histogram[0][0]).toBe('number')
  })

  it('get mempool fees', async () => {
    const response: MemPoolFees = await mempoolspace.getMemPoolFees()
    expect(response).toHaveProperty(TxPrioritySchema.enum.low)
    expect(response).toHaveProperty(TxPrioritySchema.enum.medium)
    expect(response).toHaveProperty(TxPrioritySchema.enum.high)
    expect(typeof response[TxPrioritySchema.enum.low]).toBe('number')
    expect(typeof response[TxPrioritySchema.enum.medium]).toBe('number')
    expect(typeof response[TxPrioritySchema.enum.high]).toBe('number')
  })

  it('get fiat price of transaction outputs', async () => {
    const txid =
      '4e3e822fb9d80a550198cdf460ebb964953f3daf616948d159c79e7ceed9ae75'
    const response: PriceValue[] = await mempoolspace.getPricesTxOuputs(
      'USD',
      txid
    )
    const inputCount = 8
    expect(response).toHaveLength(inputCount)
    const values = response.map((v: PriceValue) => v.fiatValue)
    const expected = [0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 477_013.5]
    for (let i = 0; i < inputCount; i += 1) {
      expect(isDiffReasonable(values[i], expected[i])).toBeTruthy()
    }
  })

  it('get fiat price of transaction inputs', async () => {
    const txid =
      'f436666296299ff113db64a7fcc05b58328595c0981ffea9f3cc9c8cae2ea90f'
    const response: PriceValue[] = await mempoolspace.getPricesTxInputs(
      'USD',
      txid
    )
    const inputCount = 7
    expect(response).toHaveLength(inputCount)
    const values = response.map((v: PriceValue) => v.fiatValue)
    const expected = [
      6137.87, 5961.42, 5745.19, 5172.51, 4521.29, 4141.71, 3976.71
    ]
    for (let i = 0; i < inputCount; i += 1) {
      expect(isDiffReasonable(values[i], expected[i])).toBeTruthy()
    }
  })
})

describe('blockchain » hashrate/difficulty', () => {
  it('get hashrate', async () => {
    const response = await mempoolspace.getCurrentHashRate()
    expect(typeof response).toBe('number')
  })

  it('get difficulty', async () => {
    const response = await mempoolspace.getCurrentDifficulty()
    expect(typeof response).toBe('number')
  })

  it('get difficulty adjusment', async () => {
    const response = await mempoolspace.getDifficultyAdjustment()
    expect(typeof response.remainingTime).toBe('number')
    expect(typeof response.remainingBlocks).toBe('number')
    expect(typeof response.progressPercent).toBe('number')
  })
})

describe('blockchain » tip block', () => {
  it('get tip block height', async () => {
    const response = await mempoolspace.getCurrentBlockHeight()
    expect(typeof response).toBe('number')
  })

  it('get tip block hash', async () => {
    const response = await mempoolspace.getCurrentBlockHash()
    expect(typeof response).toBe('string')
  })
})
