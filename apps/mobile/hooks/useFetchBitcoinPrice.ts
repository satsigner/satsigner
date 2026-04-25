import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'

export function useFetchBitcoinPrice() {
  const [fetchPrices, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.fetchPrices, state.fiatCurrency])
  )
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )

  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])
}
