import { MempoolOracle } from '@/api/blockchain'
import { getLocalPriceAt, getLocalPricesAt } from '@/api/localPrices'
import { useSettingsStore } from '@/store/settings'
import {
  resolveHistoricalPrices,
  resolvePricesAt
} from '@/utils/resolveHistoricalPrices'

jest.mock<typeof import('@/api/localPrices')>('@/api/localPrices', () => ({
  getLocalPriceAt: jest.fn(),
  getLocalPricesAt: jest.fn(),
  isUsablePrice: (price) =>
    typeof price === 'number' && Number.isFinite(price) && price >= 0
}))

const getLocalPriceAtMock = jest.mocked(getLocalPriceAt)
const getLocalPricesAtMock = jest.mocked(getLocalPricesAt)

const initialSettings = useSettingsStore.getState()

describe('resolveHistoricalPrices', () => {
  afterEach(() => {
    useSettingsStore.setState(initialSettings, true)
    jest.restoreAllMocks()
    getLocalPriceAtMock.mockReset()
  })

  it('uses local prices and does not call the api by default', async () => {
    getLocalPriceAtMock.mockImplementation((_currency, timestamp) =>
      timestamp === 100 ? 10 : null
    )
    const getPricesAt = jest.spyOn(MempoolOracle.prototype, 'getPricesAt')

    const result = await resolveHistoricalPrices('USD', [100, 999])

    expect(result).toStrictEqual({ 100: 10 })
    expect(getPricesAt).not.toHaveBeenCalled()
  })

  it('fetches local misses from the api when the network opt-in is on', async () => {
    useSettingsStore.setState({ fetchHistoricalPricesFromNetwork: true })
    getLocalPriceAtMock.mockImplementation((_currency, timestamp) =>
      timestamp === 100 ? 10 : null
    )
    const getPricesAt = jest
      .spyOn(MempoolOracle.prototype, 'getPricesAt')
      .mockResolvedValue([42])

    const result = await resolveHistoricalPrices('EUR', [100, 999])

    expect(result).toStrictEqual({ 100: 10, 999: 42 })
    expect(getPricesAt).toHaveBeenCalledWith('EUR', [999])
  })
})

describe('resolvePricesAt', () => {
  const BUNDLED_PRICES = { EUR: 9, USD: 10 }
  const NETWORK_PRICES = { EUR: 40, USD: 42 }

  afterEach(() => {
    useSettingsStore.setState(initialSettings, true)
    jest.restoreAllMocks()
    getLocalPricesAtMock.mockReset()
  })

  it('is null without looking anything up when historical prices are off', async () => {
    useSettingsStore.setState({ fetchHistoricalPrices: false })
    const getFullPriceAt = jest.spyOn(MempoolOracle.prototype, 'getFullPriceAt')

    await expect(resolvePricesAt('USD', 100)).resolves.toBeNull()
    expect(getLocalPricesAtMock).not.toHaveBeenCalled()
    expect(getFullPriceAt).not.toHaveBeenCalled()
  })

  it('uses bundled prices for every currency and does not call the api', async () => {
    useSettingsStore.setState({
      fetchHistoricalPrices: true,
      fetchHistoricalPricesFromNetwork: true
    })
    getLocalPricesAtMock.mockReturnValue(BUNDLED_PRICES)
    const getFullPriceAt = jest.spyOn(MempoolOracle.prototype, 'getFullPriceAt')

    await expect(resolvePricesAt('EUR', 100)).resolves.toStrictEqual(
      BUNDLED_PRICES
    )
    expect(getLocalPricesAtMock).toHaveBeenCalledWith(100)
    expect(getFullPriceAt).not.toHaveBeenCalled()
  })

  it('is null on a bundle miss when the network opt-in is off', async () => {
    useSettingsStore.setState({ fetchHistoricalPrices: true })
    getLocalPricesAtMock.mockReturnValue({ USD: 10 })
    const getFullPriceAt = jest.spyOn(MempoolOracle.prototype, 'getFullPriceAt')

    await expect(resolvePricesAt('EUR', 100)).resolves.toBeNull()
    expect(getFullPriceAt).not.toHaveBeenCalled()
  })

  it('fetches a bundle miss from the api when the network opt-in is on', async () => {
    useSettingsStore.setState({
      fetchHistoricalPrices: true,
      fetchHistoricalPricesFromNetwork: true
    })
    getLocalPricesAtMock.mockReturnValue({})
    const getFullPriceAt = jest
      .spyOn(MempoolOracle.prototype, 'getFullPriceAt')
      .mockResolvedValue(NETWORK_PRICES)

    await expect(resolvePricesAt('EUR', 100)).resolves.toStrictEqual(
      NETWORK_PRICES
    )
    expect(getFullPriceAt).toHaveBeenCalledWith('EUR', 100)
  })

  it('is null when the api request fails', async () => {
    useSettingsStore.setState({
      fetchHistoricalPrices: true,
      fetchHistoricalPricesFromNetwork: true
    })
    getLocalPricesAtMock.mockReturnValue({})
    jest
      .spyOn(MempoolOracle.prototype, 'getFullPriceAt')
      .mockRejectedValue(new Error('network down'))

    await expect(resolvePricesAt('EUR', 100)).resolves.toBeNull()
  })
})
