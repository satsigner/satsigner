import { MempoolOracle } from '@/api/blockchain'
import { getLocalPriceAt } from '@/api/localPrices'
import { useSettingsStore } from '@/store/settings'
import { resolveHistoricalPrices } from '@/utils/resolveHistoricalPrices'

jest.mock<typeof import('@/api/localPrices')>('@/api/localPrices', () => ({
  getLocalPriceAt: jest.fn(),
  isUsablePrice: (price) =>
    typeof price === 'number' && Number.isFinite(price) && price >= 0
}))

const getLocalPriceAtMock = jest.mocked(getLocalPriceAt)

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
