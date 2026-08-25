import {
  DEFAULT_FIAT_PRICE_API_URL,
  normalizeFiatPriceApiUrl
} from '@/constants/fiatPriceApi'
import { useSettingsStore } from '@/store/settings'

export { normalizeFiatPriceApiUrl }

export function getFiatPriceApiUrl() {
  const { fiatPriceApiUrl, fiatPriceProvider } = useSettingsStore.getState()

  if (fiatPriceProvider !== 'custom') {
    return DEFAULT_FIAT_PRICE_API_URL
  }

  const normalized = normalizeFiatPriceApiUrl(fiatPriceApiUrl)
  return normalized || DEFAULT_FIAT_PRICE_API_URL
}

export function getFiatDataSettings() {
  const { fetchCurrentPrices, fetchHistoricalPrices, fiatPriceProvider } =
    useSettingsStore.getState()

  return {
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fiatPriceApiUrl: getFiatPriceApiUrl(),
    fiatPriceProvider
  }
}
