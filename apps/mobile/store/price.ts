import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { MempoolOracle } from '@/api/blockchain'
import { getLocalLatestPrices } from '@/api/localPrices'
import mmkvStorage from '@/storage/mmkv'
import { getFiatPriceApiUrl, useSettingsStore } from '@/store/settings'
import type { Currency, Prices } from '@/types/models/Blockchain'
import { satsToFiat } from '@/utils/fiat'

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
  resetCurrentPrices: () => void
}

const usePriceStore = create<PriceState & PriceAction>()(
  persist(
    (set, get) => ({
      btcPrice: 0,
      fetchPrices: async (mempoolUrl: string) => {
        const { fetchCurrentPrices } = useSettingsStore.getState()
        if (!fetchCurrentPrices) {
          return
        }
        try {
          const oracle = new MempoolOracle(mempoolUrl)
          const prices = await oracle.getPrices()
          const { fiatCurrency } = get()
          const btcPrice = prices[fiatCurrency] ?? 0
          set({ btcPrice, prices })
        } catch {
          if (get().btcPrice > 0) {
            return
          }
          const localPrices = getLocalLatestPrices()
          const { fiatCurrency } = get()
          const btcPrice = localPrices[fiatCurrency]
          if (btcPrice === undefined) {
            return
          }
          set({
            btcPrice,
            prices: { ...EMPTY_PRICES, ...localPrices }
          })
        }
      },
      fiatCurrency: 'USD',
      prices: { ...EMPTY_PRICES },
      resetCurrentPrices: () => {
        set({ btcPrice: 0, prices: { ...EMPTY_PRICES } })
      },
      satsToFiat: (sats, btcPrice = 0) =>
        satsToFiat(
          sats,
          btcPrice || get().btcPrice,
          useSettingsStore.getState().fetchCurrentPrices
        ),
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
      storage: createJSONStorage(() => mmkvStorage),
      version: 0
    }
  )
)

useSettingsStore.subscribe((state, prevState) => {
  if (prevState.fetchCurrentPrices && !state.fetchCurrentPrices) {
    usePriceStore.getState().resetCurrentPrices()
    return
  }

  if (!prevState.fetchCurrentPrices && state.fetchCurrentPrices) {
    void usePriceStore.getState().fetchPrices(getFiatPriceApiUrl())
  }

  if (!prevState.fetchHistoricalPrices && state.fetchHistoricalPrices) {
    void backfillFromSettings()
  }

  if (
    !prevState.fetchHistoricalPricesFromNetwork &&
    state.fetchHistoricalPricesFromNetwork &&
    state.fetchHistoricalPrices
  ) {
    void backfillFromSettings()
  }
})

async function backfillFromSettings() {
  try {
    const { backfillHistoricalPrices } =
      await import('@/utils/historicalPrices')
    await backfillHistoricalPrices()
  } catch {
    // Non-fatal — user can pull-to-refresh to retry via sync.
  }
}

export { usePriceStore }
