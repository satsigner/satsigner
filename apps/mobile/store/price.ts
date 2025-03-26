import { create } from 'zustand'

import { MempoolOracle } from '@/api/blockchain'
import { type Currency, type Prices } from '@/types/models/Blockchain'

type PriceState = {
  prices: Prices
  fiatCurrency: Currency
  /** Price in the current fiat currency */
  btcPrice: number
}

type PriceAction = {
  satsToFiat: (sats: number, btcPrice?: number) => number
  fetchPrices: () => Promise<void>
  fetchFullPriceAt: (timestamps: number) => Promise<void>
}

const SATS_IN_BITCOIN = 100_000_000

const usePriceStore = create<PriceState & PriceAction>()((set, get) => ({
  prices: {
    AUD: 0,
    CAD: 0,
    CHF: 0,
    EUR: 0,
    GBP: 0,
    JPY: 0,
    USD: 0
  },
  fiatCurrency: 'USD',
  btcPrice: 0,
  satsToFiat: (sats, btcPrice = 0) => {
    const bitcoinPrice = btcPrice || get().btcPrice

    return (sats / SATS_IN_BITCOIN) * bitcoinPrice
  },
  fetchPrices: async () => {
    const oracle = new MempoolOracle()
    const prices = await oracle.getPrices()

    const { fiatCurrency } = get()
    const btcPrice = prices[fiatCurrency] ?? 0

    set({ prices, btcPrice })
  },
  fetchFullPriceAt: async (timestamp: number) => {
    const { fiatCurrency } = get()

    const oracle = new MempoolOracle()
    const prices = await oracle.getFullPriceAt(fiatCurrency, timestamp)
    const btcPrice = prices[fiatCurrency] ?? 0

    set({ prices, btcPrice })
  }
}))

export { usePriceStore }
