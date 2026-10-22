import { useShallow } from 'zustand/react/shallow'

import { getFiatPriceApiUrl, useSettingsStore } from '@/store/settings'

export function useFiatData() {
  const [
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fetchHistoricalPricesFromNetwork,
    fiatPriceApiUrl,
    fiatPriceProvider,
    setFetchCurrentPrices,
    setFetchHistoricalPrices,
    setFetchHistoricalPricesFromNetwork,
    setFiatPriceApiUrl,
    setFiatPriceProvider
  ] = useSettingsStore(
    useShallow((state) => [
      state.fetchCurrentPrices,
      state.fetchHistoricalPrices,
      state.fetchHistoricalPricesFromNetwork,
      state.fiatPriceApiUrl,
      state.fiatPriceProvider,
      state.setFetchCurrentPrices,
      state.setFetchHistoricalPrices,
      state.setFetchHistoricalPricesFromNetwork,
      state.setFiatPriceApiUrl,
      state.setFiatPriceProvider
    ])
  )

  return {
    customFiatPriceApiUrl: fiatPriceApiUrl,
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fetchHistoricalPricesFromNetwork,
    fiatPriceApiUrl: getFiatPriceApiUrl(),
    fiatPriceProvider,
    setCustomFiatPriceApiUrl: setFiatPriceApiUrl,
    setFetchCurrentPrices,
    setFetchHistoricalPrices,
    setFetchHistoricalPricesFromNetwork,
    setFiatPriceApiUrl,
    setFiatPriceProvider,
    showCurrentFiat: fetchCurrentPrices,
    showHistoricalFiat: fetchHistoricalPrices,
    useCustomFiatPriceProvider: fiatPriceProvider === 'custom'
  }
}
