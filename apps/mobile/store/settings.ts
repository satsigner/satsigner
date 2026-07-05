import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { DEFAULT_FIAT_PRICE_API_URL } from '@/constants/fiatPriceApi'
import mmkvStorage from '@/storage/mmkv'
import { usePriceStore } from '@/store/price'
import { normalizeFiatPriceApiUrl } from '@/utils/fiatData'
import { type WordListName, DEFAULT_WORD_LIST } from '@/types/bips/39'

type SettingsState = {
  mnemonicWordList: WordListName
  useZeroPadding: boolean
  currencyUnit: 'sats' | 'btc'
  showWarning: boolean
  skipSeedConfirmation: boolean
  privacyMode: boolean
  fetchCurrentPrices: boolean
  fetchHistoricalPrices: boolean
  fiatPriceApiUrl: string
}

type SettingsAction = {
  setCurrencyUnit: (currencyUnit: SettingsState['currencyUnit']) => void
  setUseZeroPadding: (useZeroPadding: SettingsState['useZeroPadding']) => void
  setShowWarning: (showWarning: SettingsState['showWarning']) => void
  setSkipSeedConfirmation: (skip: SettingsState['skipSeedConfirmation']) => void
  setMnemonicWordList: (wordList: SettingsState['mnemonicWordList']) => void
  setFetchCurrentPrices: (
    fetchCurrentPrices: SettingsState['fetchCurrentPrices']
  ) => void
  setFetchHistoricalPrices: (
    fetchHistoricalPrices: SettingsState['fetchHistoricalPrices']
  ) => void
  setFiatPriceApiUrl: (fiatPriceApiUrl: SettingsState['fiatPriceApiUrl']) => void
  togglePrivacyMode: () => void
}

const useSettingsStore = create<SettingsState & SettingsAction>()(
  persist(
    (set) => ({
      currencyUnit: 'sats',
      fetchCurrentPrices: true,
      fetchHistoricalPrices: false,
      fiatPriceApiUrl: DEFAULT_FIAT_PRICE_API_URL,
      mnemonicWordList: DEFAULT_WORD_LIST,
      privacyMode: false,
      setCurrencyUnit: (currencyUnit) => {
        set({ currencyUnit })
      },
      setMnemonicWordList: (mnemonicWordList) => {
        set({ mnemonicWordList })
      },
      setFetchCurrentPrices: (fetchCurrentPrices) => {
        set({ fetchCurrentPrices })
        if (!fetchCurrentPrices) {
          usePriceStore.getState().resetCurrentPrices()
        }
      },
      setFetchHistoricalPrices: (fetchHistoricalPrices) => {
        set({ fetchHistoricalPrices })
      },
      setFiatPriceApiUrl: (fiatPriceApiUrl) => {
        set({ fiatPriceApiUrl: normalizeFiatPriceApiUrl(fiatPriceApiUrl) })
      },
      setShowWarning: (showWarning) => {
        set({ showWarning })
      },
      setSkipSeedConfirmation: (skipSeedConfirmation) => {
        set({ skipSeedConfirmation })
      },
      setUseZeroPadding: (useZeroPadding) => {
        set({ useZeroPadding })
      },
      showWarning: true,
      skipSeedConfirmation: true,
      togglePrivacyMode: () =>
        set((state) => ({ privacyMode: !state.privacyMode })),
      useZeroPadding: false
    }),
    { name: 'settings-store', storage: createJSONStorage(() => mmkvStorage) }
  )
)

export { useSettingsStore }
