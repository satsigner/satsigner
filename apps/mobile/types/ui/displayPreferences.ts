import { type Currency } from '@/types/models/Blockchain'

export type CurrencyUnit = 'sats' | 'btc'

/** Props shape shared by components that render amounts. */
export type DisplayPreferences = {
  btcPrice: number
  currencyUnit: CurrencyUnit
  fiatCurrency: Currency
  fiatEnabled: boolean
  historicalFiatEnabled: boolean
  privacyMode: boolean
  useZeroPadding: boolean
}
