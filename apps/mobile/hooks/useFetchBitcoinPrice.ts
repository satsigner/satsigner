import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useFiatData } from '@/hooks/useFiatData'
import { usePriceStore } from '@/store/price'
import { getFiatPriceApiUrl } from '@/utils/fiatData'

export function useFetchBitcoinPrice() {
  const { fiatPriceApiUrl, showCurrentFiat } = useFiatData()
  const [fetchPrices, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.fetchPrices, state.fiatCurrency])
  )

  useEffect(() => {
    if (!showCurrentFiat) {
      return
    }
    fetchPrices(getFiatPriceApiUrl())
  }, [fetchPrices, fiatCurrency, fiatPriceApiUrl, showCurrentFiat])
}
