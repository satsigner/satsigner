import { DEFAULT_FIAT_PRICE_API_URL } from '@/constants/fiatPriceApi'
import { migrateFiatPriceSettings, useSettingsStore } from '@/store/settings'
import {
  getFiatDataSettings,
  getFiatPriceApiUrl,
  normalizeFiatPriceApiUrl
} from '@/utils/fiatData'

const initialState = useSettingsStore.getState()

describe('fiat data helpers', () => {
  afterEach(() => {
    useSettingsStore.setState(initialState, true)
  })

  describe('normalizeFiatPriceApiUrl', () => {
    it('trims surrounding whitespace', () => {
      expect(normalizeFiatPriceApiUrl('  https://example.com  ')).toBe(
        'https://example.com'
      )
    })

    it('strips trailing slashes', () => {
      expect(normalizeFiatPriceApiUrl('https://example.com///')).toBe(
        'https://example.com'
      )
    })

    it('returns an empty string for blank input', () => {
      expect(normalizeFiatPriceApiUrl('   ')).toBe('')
    })
  })

  describe('getFiatPriceApiUrl', () => {
    it('returns the default url for the mempool provider', () => {
      useSettingsStore.setState({
        fiatPriceApiUrl: 'https://custom.example.com',
        fiatPriceProvider: 'mempool'
      })
      expect(getFiatPriceApiUrl()).toBe(DEFAULT_FIAT_PRICE_API_URL)
    })

    it('returns the normalized custom url for the custom provider', () => {
      useSettingsStore.setState({
        fiatPriceApiUrl: 'https://custom.example.com/',
        fiatPriceProvider: 'custom'
      })
      expect(getFiatPriceApiUrl()).toBe('https://custom.example.com')
    })

    it('falls back to the default url when the custom url is empty', () => {
      useSettingsStore.setState({
        fiatPriceApiUrl: '',
        fiatPriceProvider: 'custom'
      })
      expect(getFiatPriceApiUrl()).toBe(DEFAULT_FIAT_PRICE_API_URL)
    })
  })

  describe('getFiatDataSettings', () => {
    it('resolves the api url alongside the fetch toggles', () => {
      useSettingsStore.setState({
        fetchCurrentPrices: true,
        fetchHistoricalPrices: false,
        fiatPriceApiUrl: 'https://custom.example.com',
        fiatPriceProvider: 'custom'
      })
      expect(getFiatDataSettings()).toStrictEqual({
        fetchCurrentPrices: true,
        fetchHistoricalPrices: false,
        fiatPriceApiUrl: 'https://custom.example.com',
        fiatPriceProvider: 'custom'
      })
    })
  })

  describe('migrateFiatPriceSettings', () => {
    function getMerged() {
      return useSettingsStore.getState()
    }

    function makeMerged(overrides: Partial<ReturnType<typeof getMerged>> = {}) {
      return { ...getMerged(), ...overrides }
    }

    it('leaves state untouched when nothing was persisted', () => {
      const merged = makeMerged({
        fiatPriceApiUrl: '',
        fiatPriceProvider: 'mempool'
      })
      const result = migrateFiatPriceSettings(undefined, merged)
      expect(result.fiatPriceProvider).toBe('mempool')
      expect(result.fiatPriceApiUrl).toBe('')
    })

    it('leaves state untouched when the provider was already persisted', () => {
      const merged = makeMerged({
        fiatPriceApiUrl: 'https://custom.example.com',
        fiatPriceProvider: 'custom'
      })
      const result = migrateFiatPriceSettings(
        { fiatPriceProvider: 'custom' },
        merged
      )
      expect(result.fiatPriceProvider).toBe('custom')
      expect(result.fiatPriceApiUrl).toBe('https://custom.example.com')
    })

    it('migrates a legacy custom url to the custom provider', () => {
      const merged = makeMerged()
      const result = migrateFiatPriceSettings(
        { fiatPriceApiUrl: 'https://legacy.example.com/' },
        merged
      )
      expect(result.fiatPriceProvider).toBe('custom')
      expect(result.fiatPriceApiUrl).toBe('https://legacy.example.com')
    })

    it('migrates a legacy default url back to the mempool provider', () => {
      const merged = makeMerged()
      const result = migrateFiatPriceSettings(
        { fiatPriceApiUrl: DEFAULT_FIAT_PRICE_API_URL },
        merged
      )
      expect(result.fiatPriceProvider).toBe('mempool')
      expect(result.fiatPriceApiUrl).toBe('')
    })

    it('migrates a missing legacy url to the mempool provider', () => {
      const merged = makeMerged()
      const result = migrateFiatPriceSettings({}, merged)
      expect(result.fiatPriceProvider).toBe('mempool')
      expect(result.fiatPriceApiUrl).toBe('')
    })
  })
})
