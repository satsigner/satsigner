import { DEFAULT_FIAT_PRICE_API_URL } from '@/constants/fiatPriceApi'
import { useSettingsStore } from '@/store/settings'

export function normalizeFiatPriceApiUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

export function getFiatPriceApiUrl() {
  const { fiatPriceApiUrl, fiatPriceProvider } = useSettingsStore.getState()

  if (fiatPriceProvider !== 'custom') {
    return DEFAULT_FIAT_PRICE_API_URL
  }

  const normalized = normalizeFiatPriceApiUrl(fiatPriceApiUrl)
  return normalized || DEFAULT_FIAT_PRICE_API_URL
}

export function getFiatDataSettings() {
  const {
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fiatPriceApiUrl,
    fiatPriceProvider
  } = useSettingsStore.getState()

  return {
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fiatPriceApiUrl: getFiatPriceApiUrl(),
    fiatPriceProvider
  }
}
