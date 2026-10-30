import { useShallow } from 'zustand/react/shallow'

import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { type DisplayPreferences } from '@/types/ui/displayPreferences'

/**
 * Amount display settings and the current bitcoin price, for screens to pass
 * down to `SS` components as props. Subscribing once here keeps list cells
 * from each subscribing to the stores themselves.
 */
export function useDisplayPreferences(): DisplayPreferences {
  const [
    currencyUnit,
    fiatEnabled,
    historicalFiatEnabled,
    privacyMode,
    useZeroPadding
  ] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.fetchCurrentPrices,
      state.fetchHistoricalPrices,
      state.privacyMode,
      state.useZeroPadding
    ])
  )
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  return {
    btcPrice,
    currencyUnit,
    fiatCurrency,
    fiatEnabled,
    historicalFiatEnabled,
    privacyMode,
    useZeroPadding
  }
}
