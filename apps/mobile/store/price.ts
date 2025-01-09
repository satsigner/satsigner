import { create } from 'zustand'

import { MempoolOracle } from '@/api/blockchain'
import { Currency, Prices } from '@/types/models/Blockchain'
// import { useBlockchainStore } from './blockchain'

type PriceState = {
  prices: Prices
  fiatCurrency: Currency
  btcPrice: number // price in the current fiat currency
}

type PriceAction = {
  satsToFiat: (sats: number, btcPrice?: number) => number
  fetchPrices: () => Promise<void>
}

const SATS_IN_BITCOIN = 100_000_000

const usePriceStore = create<PriceState & PriceAction>()((set, get) => ({
  prices: {},
  fiatCurrency: 'USD',
  btcPrice: 0,
  satsToFiat: (sats, btcPrice = 0) => {
    const bitcoinPrice = btcPrice || get().btcPrice
    return (sats / SATS_IN_BITCOIN) * bitcoinPrice
  },
  fetchPrices: async () => {
    // const { url } = useBlockchainStore.getState()
    const oracle = new MempoolOracle()
    const prices = await oracle.getPrices()
    const { fiatCurrency } = get()
    const btcPrice = prices[fiatCurrency]
    set({ prices, btcPrice })
  }
}))

export { usePriceStore }
