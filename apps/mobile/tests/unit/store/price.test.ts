import { MempoolOracle } from '@/api/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import type { Prices } from '@/types/models/Blockchain'

const MEMPOOL_URL = 'https://mempool.space/api'

const SAMPLE_PRICES: Prices = {
  AUD: 150_000,
  CAD: 140_000,
  CHF: 90_000,
  EUR: 95_000,
  GBP: 80_000,
  JPY: 15_000_000,
  USD: 100_000
}

describe('price store fetchPrices', () => {
  beforeEach(() => {
    useSettingsStore.setState({ fetchCurrentPrices: true })
    usePriceStore.getState().resetCurrentPrices()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('updates btcPrice from a successful response', async () => {
    jest.spyOn(MempoolOracle.prototype, 'getPrices').mockResolvedValue({
      ...SAMPLE_PRICES
    })

    await usePriceStore.getState().fetchPrices(MEMPOOL_URL)

    expect(usePriceStore.getState().btcPrice).toBe(100_000)
    expect(usePriceStore.getState().prices.USD).toBe(100_000)
  })

  it('does not throw or clear prices when the API resets the socket', async () => {
    const getPrices = jest
      .spyOn(MempoolOracle.prototype, 'getPrices')
      .mockResolvedValue({
        ...SAMPLE_PRICES
      })
    await usePriceStore.getState().fetchPrices(MEMPOOL_URL)

    getPrices.mockRejectedValue(
      new Error('fetch failed: java.net.SocketException: Connection reset')
    )

    await expect(
      usePriceStore.getState().fetchPrices(MEMPOOL_URL)
    ).resolves.toBeUndefined()

    expect(usePriceStore.getState().btcPrice).toBe(100_000)
    expect(usePriceStore.getState().prices.USD).toBe(100_000)
  })
})
