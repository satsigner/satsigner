import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  DEFAULT_FIAT_PRICE_API_URL,
  normalizeFiatPriceApiUrl
} from '@/constants/fiatPriceApi'
import mmkvStorage from '@/storage/mmkv'
import { type WordListName, DEFAULT_WORD_LIST } from '@/types/bips/39'
import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'

type FiatPriceProvider = 'custom' | 'mempool'

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
  fiatPriceProvider: FiatPriceProvider
  defaultAutoSelectUtxos: AutoSelectUtxosAlgorithm
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
  setFiatPriceApiUrl: (
    fiatPriceApiUrl: SettingsState['fiatPriceApiUrl']
  ) => void
  setFiatPriceProvider: (
    fiatPriceProvider: SettingsState['fiatPriceProvider']
  ) => void
  setDefaultAutoSelectUtxos: (
    algorithm: SettingsState['defaultAutoSelectUtxos']
  ) => void
  togglePrivacyMode: () => void
}

function migrateFiatPriceSettings(
  persisted: Partial<SettingsState> | undefined,
  merged: SettingsState & SettingsAction
) {
  if (!persisted || 'fiatPriceProvider' in persisted) {
    return merged
  }

  const legacyUrl = normalizeFiatPriceApiUrl(persisted.fiatPriceApiUrl ?? '')

  if (legacyUrl && legacyUrl !== DEFAULT_FIAT_PRICE_API_URL) {
    merged.fiatPriceProvider = 'custom'
    merged.fiatPriceApiUrl = legacyUrl
  } else {
    merged.fiatPriceProvider = 'mempool'
    merged.fiatPriceApiUrl = ''
  }

  return merged
}

const useSettingsStore = create<SettingsState & SettingsAction>()(
  persist(
    (set) => ({
      currencyUnit: 'sats',
      defaultAutoSelectUtxos: 'privacy',
      fetchCurrentPrices: true,
      fetchHistoricalPrices: false,
      fiatPriceApiUrl: '',
      fiatPriceProvider: 'mempool',
      mnemonicWordList: DEFAULT_WORD_LIST,
      privacyMode: false,
      setCurrencyUnit: (currencyUnit) => {
        set({ currencyUnit })
      },
      setDefaultAutoSelectUtxos: (defaultAutoSelectUtxos) => {
        set({ defaultAutoSelectUtxos })
      },
      setFetchCurrentPrices: (fetchCurrentPrices) => {
        set({ fetchCurrentPrices })
      },
      setFetchHistoricalPrices: (fetchHistoricalPrices) => {
        set({ fetchHistoricalPrices })
      },
      setFiatPriceApiUrl: (fiatPriceApiUrl) => {
        set({ fiatPriceApiUrl: normalizeFiatPriceApiUrl(fiatPriceApiUrl) })
      },
      setFiatPriceProvider: (fiatPriceProvider) => {
        set({ fiatPriceProvider })
      },
      setMnemonicWordList: (mnemonicWordList) => {
        set({ mnemonicWordList })
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
    {
      merge: (persistedState, currentState) =>
        migrateFiatPriceSettings(
          persistedState as Partial<SettingsState> | undefined,
          { ...currentState, ...(persistedState as Partial<SettingsState>) }
        ),
      name: 'settings-store',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { migrateFiatPriceSettings, useSettingsStore }
export type { FiatPriceProvider }
