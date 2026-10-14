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
  const ALL_BUNDLED_PRICES = {
    AUD: 1,
    CAD: 2,
    CHF: 3,
    EUR: 4,
    GBP: 5,
    JPY: 6,
    USD: 7
  }
  const SOME_BUNDLED_PRICES = { USD: 7 }

  function enableHistoricalPrices(fromNetwork: boolean) {
    useSettingsStore.setState({
      fetchHistoricalPrices: true,
      fetchHistoricalPricesFromNetwork: fromNetwork
    })
  }

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

  it('uses bundled prices and does not call the api when all are bundled', async () => {
    enableHistoricalPrices(true)
    getLocalPricesAtMock.mockReturnValue(ALL_BUNDLED_PRICES)
    const getFullPriceAt = jest.spyOn(MempoolOracle.prototype, 'getFullPriceAt')

    await expect(resolvePricesAt('EUR', 100)).resolves.toStrictEqual(
      ALL_BUNDLED_PRICES
    )
    expect(getLocalPricesAtMock).toHaveBeenCalledWith(100)
    expect(getFullPriceAt).not.toHaveBeenCalled()
  })

  it('returns only the bundled prices when the network opt-in is off', async () => {
    enableHistoricalPrices(false)
    getLocalPricesAtMock.mockReturnValue(SOME_BUNDLED_PRICES)
    const getFullPriceAt = jest.spyOn(MempoolOracle.prototype, 'getFullPriceAt')

    await expect(resolvePricesAt('EUR', 100)).resolves.toStrictEqual(
      SOME_BUNDLED_PRICES
    )
    expect(getFullPriceAt).not.toHaveBeenCalled()
  })

  it('is null when nothing is bundled and the network opt-in is off', async () => {
    enableHistoricalPrices(false)
    getLocalPricesAtMock.mockReturnValue({})

    await expect(resolvePricesAt('EUR', 100)).resolves.toBeNull()
  })

  it('fills currencies missing from the bundle with usable api prices', async () => {
    enableHistoricalPrices(true)
    getLocalPricesAtMock.mockReturnValue(SOME_BUNDLED_PRICES)
    const getFullPriceAt = jest
      .spyOn(MempoolOracle.prototype, 'getFullPriceAt')
      .mockResolvedValue({ CHF: -1, EUR: 40, USD: 42 })

    await expect(resolvePricesAt('EUR', 100)).resolves.toStrictEqual({
      EUR: 40,
      USD: 7
    })
    expect(getFullPriceAt).toHaveBeenCalledWith('EUR', 100)
  })

  it('keeps the bundled prices when the api request fails', async () => {
    enableHistoricalPrices(true)
    getLocalPricesAtMock.mockReturnValue(SOME_BUNDLED_PRICES)
    jest
      .spyOn(MempoolOracle.prototype, 'getFullPriceAt')
      .mockRejectedValue(new Error('network down'))

    await expect(resolvePricesAt('EUR', 100)).resolves.toStrictEqual(
      SOME_BUNDLED_PRICES
    )
  })

  it('is null when nothing is bundled and the api request fails', async () => {
    enableHistoricalPrices(true)
    getLocalPricesAtMock.mockReturnValue({})
    jest
      .spyOn(MempoolOracle.prototype, 'getFullPriceAt')
      .mockRejectedValue(new Error('network down'))

    await expect(resolvePricesAt('EUR', 100)).resolves.toBeNull()
  })
})
