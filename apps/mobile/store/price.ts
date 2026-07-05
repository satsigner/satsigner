import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { MempoolOracle } from '@/api/blockchain'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import mmkvStorage from '@/storage/mmkv'
import { useSettingsStore } from '@/store/settings'
import type { Currency, Prices } from '@/types/models/Blockchain'

const EMPTY_PRICES: Prices = {
  AUD: 0,
  CAD: 0,
  CHF: 0,
  EUR: 0,
  GBP: 0,
  JPY: 0,
  USD: 0
}

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
  resetCurrentPrices: () => void
}

const usePriceStore = create<PriceState & PriceAction>()(
  persist(
    (set, get) => ({
      btcPrice: 0,
      fetchFullPriceAt: async (mempoolUrl: string, timestamp: number) => {
        const { fetchHistoricalPrices } = useSettingsStore.getState()
        if (!fetchHistoricalPrices) {
          return
        }
        const { fiatCurrency } = get()
        const oracle = new MempoolOracle(mempoolUrl)
        const prices = await oracle.getFullPriceAt(fiatCurrency, timestamp)
        const btcPrice = prices[fiatCurrency] ?? 0
        set({ btcPrice, prices })
      },
      fetchPrices: async (mempoolUrl: string) => {
        const { fetchCurrentPrices } = useSettingsStore.getState()
        if (!fetchCurrentPrices) {
          return
        }
        const oracle = new MempoolOracle(mempoolUrl)
        const prices = await oracle.getPrices()
        const { fiatCurrency } = get()
        const btcPrice = prices[fiatCurrency] ?? 0
        set({ btcPrice, prices })
      },
      fiatCurrency: 'USD',
      prices: { ...EMPTY_PRICES },
      resetCurrentPrices: () => {
        set({ btcPrice: 0, prices: { ...EMPTY_PRICES } })
      },
      satsToFiat: (sats, btcPrice = 0) => {
        if (!useSettingsStore.getState().fetchCurrentPrices) {
          return 0
        }
        if (!sats || sats <= 0) {
          return 0
        }
        const bitcoinPrice = btcPrice || get().btcPrice
        if (bitcoinPrice <= 0) {
          return 0
        }
        return (sats / SATS_PER_BITCOIN) * bitcoinPrice
      },
      setFiatCurrency: (currency: Currency) => {
        const { fetchCurrentPrices } = useSettingsStore.getState()
        if (!fetchCurrentPrices) {
          set({ btcPrice: 0, fiatCurrency: currency })
          return
        }
        const { prices } = get()
        set({ btcPrice: prices[currency] ?? 0, fiatCurrency: currency })
      }
    }),
    {
      name: 'price-store',
      partialize: (state) => ({ fiatCurrency: state.fiatCurrency }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { usePriceStore }
