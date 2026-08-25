import { useShallow } from 'zustand/react/shallow'

import { useSettingsStore } from '@/store/settings'
import { getFiatPriceApiUrl } from '@/utils/fiatData'

export function useFiatData() {
  const [
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fiatPriceApiUrl,
    fiatPriceProvider,
    setFetchCurrentPrices,
    setFetchHistoricalPrices,
    setFiatPriceApiUrl,
    setFiatPriceProvider
  ] = useSettingsStore(
    useShallow((state) => [
      state.fetchCurrentPrices,
      state.fetchHistoricalPrices,
      state.fiatPriceApiUrl,
      state.fiatPriceProvider,
      state.setFetchCurrentPrices,
      state.setFetchHistoricalPrices,
      state.setFiatPriceApiUrl,
      state.setFiatPriceProvider
    ])
  )

  return {
    customFiatPriceApiUrl: fiatPriceApiUrl,
    fetchCurrentPrices,
    fetchHistoricalPrices,
    fiatPriceApiUrl: getFiatPriceApiUrl(),
    fiatPriceProvider,
    setCustomFiatPriceApiUrl: setFiatPriceApiUrl,
    setFetchCurrentPrices,
    setFetchHistoricalPrices,
    setFiatPriceApiUrl,
    setFiatPriceProvider,
    showCurrentFiat: fetchCurrentPrices,
    showHistoricalFiat: fetchHistoricalPrices,
    useCustomFiatPriceProvider: fiatPriceProvider === 'custom'
  }
}

export { getFiatDataSettings, getFiatPriceApiUrl } from '@/utils/fiatData'
