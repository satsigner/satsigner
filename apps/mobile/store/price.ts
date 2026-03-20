import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { MempoolOracle } from '@/api/blockchain'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import mmkvStorage from '@/storage/mmkv'
import type { Currency, Prices } from '@/types/models/Blockchain'

type PriceState = {
  prices: Prices
  fiatCurrency: Currency
  /** Price in the current fiat currency */
  btcPrice: number
}

type PriceAction = {
  satsToFiat: (sats: number, btcPrice?: number) => number
  setFiatCurrency: (currency: Currency) => void
  fetchPrices: (mempoolUrl: string) => Promise<void>
  fetchFullPriceAt: (mempoolUrl: string, timestamps: number) => Promise<void>
}

const usePriceStore = create<PriceState & PriceAction>()(
  persist(
    (set, get) => ({
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
        if (!sats || sats <= 0) return 0
        const bitcoinPrice = btcPrice || get().btcPrice
        if (bitcoinPrice <= 0) return 0
        return (sats / SATS_PER_BITCOIN) * bitcoinPrice
      },
      setFiatCurrency: (currency: Currency) => {
        const { prices } = get()
        set({ fiatCurrency: currency, btcPrice: prices[currency] ?? 0 })
      },
      fetchPrices: async (mempoolUrl: string) => {
        const oracle = new MempoolOracle(mempoolUrl)
        const prices = await oracle.getPrices()
        const { fiatCurrency } = get()
        const btcPrice = prices[fiatCurrency] ?? 0
        set({ prices, btcPrice })
      },
      fetchFullPriceAt: async (mempoolUrl: string, timestamp: number) => {
        const { fiatCurrency } = get()
        const oracle = new MempoolOracle(mempoolUrl)
        const prices = await oracle.getFullPriceAt(fiatCurrency, timestamp)
        const btcPrice = prices[fiatCurrency] ?? 0
        set({ prices, btcPrice })
      }
    }),
    {
      name: 'price-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ fiatCurrency: state.fiatCurrency })
    }
  )
)

export { usePriceStore }
