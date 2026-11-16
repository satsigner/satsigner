import { useSettingsStore } from '@/store/settings'
import {
  fetchPriceAtTimestamp,
  getPriceDateTimestamp
} from '@/utils/priceAtDate'

describe('getPriceDateTimestamp', () => {
  it('uses the UTC midnight of the picked calendar day', () => {
    const picked = new Date(2025, 3, 11, 21, 45)
    expect(getPriceDateTimestamp(picked)).toBe(Date.UTC(2025, 3, 11) / 1000)
  })
})

describe('fetchPriceAtTimestamp', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      fetchHistoricalPrices: true,
      fetchHistoricalPricesFromNetwork: false
    })
  })

  it('returns the bundled close for a past day', async () => {
    const price = await fetchPriceAtTimestamp(
      'USD',
      getPriceDateTimestamp(new Date(2024, 0, 15))
    )
    expect(price).toBeGreaterThan(0)
  })

  it('returns null without a date', async () => {
    await expect(fetchPriceAtTimestamp('USD', undefined)).resolves.toBeNull()
  })

  it('returns null when historical prices are off', async () => {
    useSettingsStore.setState({ fetchHistoricalPrices: false })
    const price = await fetchPriceAtTimestamp(
      'USD',
      getPriceDateTimestamp(new Date(2024, 0, 15))
    )
    expect(price).toBeNull()
  })
})
