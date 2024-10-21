import { create } from 'zustand'

type PriceState = {
  bitcoinPrice: number
  fiatCurrency: 'USD'
}

type PriceAction = {
  satsToFiat: (sats: number) => number
}

const SATS_IN_BITCOIN = 100_000_000

const usePriceStore = create<PriceState & PriceAction>()((set, get) => ({
  bitcoinPrice: 68000, // Temp hardcode
  fiatCurrency: 'USD',
  satsToFiat: (sats) => {
    return (sats / SATS_IN_BITCOIN) * get().bitcoinPrice
  }
}))

export { usePriceStore }
