import { MempoolOracle } from '@/api/blockchain'
import { BlockchainOracle, TxPriority } from '@/types/models/Blockchain'

const mempoolspace: BlockchainOracle = new MempoolOracle()

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
})

describe('Blockchain » mempool', () => {
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
