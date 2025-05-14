import { MempoolOracle } from '@/api/blockchain'
import {
  type BlockchainOracle,
  type PriceValue,
  TxPriority
} from '@/types/models/Blockchain'

const mempoolspace: BlockchainOracle = new MempoolOracle(
  'https://mempool.space/api'
)

describe('Blockchain » price', () => {
  it('get price at given currency', async () => {
    const response = await mempoolspace.getPrice('CAD')
    expect(typeof response).toBe('number')
  })
  it('get price at given currency at given time', async () => {
    const timestamp = 1500000000
    const expectedPrice = 1964
    const response = await mempoolspace.getPriceAt('EUR', timestamp)
    expect(response).toBe(expectedPrice)
  })
  it('get prices list at given time', async () => {
    const timestamp = 1500000000
    const expectedPrice = 2254.9
    const response = await mempoolspace.getFullPriceAt('USD', timestamp)
    expect(typeof response).toBe('object')
    expect(response['USD']).toBe(expectedPrice)
    expect(typeof response['USD']).toBe('number')
  })
})

describe('Blockchain » mempool', () => {
  const errorTolerance = 0.015 // 1.5%
  const isDiffReasonable = (a: number, b: number) => {
    return Math.abs((a - b) / b) < errorTolerance
  }

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
    const response = await mempoolspace.getMemPoolFees()
    expect(response).toHaveProperty(TxPriority.low)
    expect(response).toHaveProperty(TxPriority.medium)
    expect(response).toHaveProperty(TxPriority.high)
    expect(typeof response[TxPriority.low]).toBe('number')
    expect(typeof response[TxPriority.medium]).toBe('number')
    expect(typeof response[TxPriority.high]).toBe('number')
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
    const expected = [0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 477013.5]
    for (let i = 0; i < inputCount; i++) {
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
    for (let i = 0; i < inputCount; i++) {
      expect(isDiffReasonable(values[i], expected[i])).toBeTruthy()
    }
  })
})

describe('Blockchain » hashrate/difficulty', () => {
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

describe('Blockchain » tip block', () => {
  it('get tip block height', async () => {
    const response = await mempoolspace.getCurrentBlockHeight()
    expect(typeof response).toBe('number')
  })
  it('get tip block hash', async () => {
    const response = await mempoolspace.getCurrentBlockHash()
    expect(typeof response).toBe('string')
  })
})
