import { DEFAULT_FIAT_PRICE_API_URL } from '@/constants/fiatPriceApi'
import { useSettingsStore } from '@/store/settings'

export function normalizeFiatPriceApiUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

export function getFiatPriceApiUrl() {
  const { fiatPriceApiUrl } = useSettingsStore.getState()
  const normalized = normalizeFiatPriceApiUrl(fiatPriceApiUrl)
  return normalized || DEFAULT_FIAT_PRICE_API_URL
}

export function getFiatDataSettings() {
  const { fetchCurrentPrices, fetchHistoricalPrices, fiatPriceApiUrl } =
    useSettingsStore.getState()
  return { fetchCurrentPrices, fetchHistoricalPrices, fiatPriceApiUrl }
}
