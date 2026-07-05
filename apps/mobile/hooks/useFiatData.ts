import { useShallow } from 'zustand/react/shallow'

import { useSettingsStore } from '@/store/settings'

export function useFiatData() {
  const [
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fiatPriceApiUrl,
    setFetchCurrentPrices,
    setFetchHistoricalPrices,
    setFiatPriceApiUrl
  ] = useSettingsStore(
    useShallow((state) => [
      state.fetchCurrentPrices,
      state.fetchHistoricalPrices,
      state.fiatPriceApiUrl,
      state.setFetchCurrentPrices,
      state.setFetchHistoricalPrices,
      state.setFiatPriceApiUrl
    ])
  )

  return {
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fiatPriceApiUrl,
    setFetchCurrentPrices,
    setFetchHistoricalPrices,
    setFiatPriceApiUrl,
    showCurrentFiat: fetchCurrentPrices,
    showHistoricalFiat: fetchHistoricalPrices
  }
}

export { getFiatDataSettings, getFiatPriceApiUrl } from '@/utils/fiatData'
