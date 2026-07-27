import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  DEFAULT_FIAT_PRICE_API_URL,
  normalizeFiatPriceApiUrl
} from '@/constants/fiatPriceApi'
import { PAYJOIN_SESSION_TTL_MS } from '@/constants/payjoin'
import mmkvStorage from '@/storage/mmkv'
import { type WordListName, DEFAULT_WORD_LIST } from '@/types/bips/39'
import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import { normalizePayjoinSessionTtlMs } from '@/utils/payjoinTtl'

type FiatPriceProvider = 'custom' | 'mempool'

type SettingsState = {
  mnemonicWordList: WordListName
  useZeroPadding: boolean
  currencyUnit: 'sats' | 'btc'
  showWarning: boolean
  skipSeedConfirmation: boolean
  privacyMode: boolean
  /** When true, BIP21 receive URIs include a Payjoin session (default on). */
  payjoinEnabled: boolean
  /** Receiver/sender session TTL in ms (1 / 5 / 10 minute presets). */
  payjoinSessionTtlMs: number
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
  setPayjoinEnabled: (payjoinEnabled: SettingsState['payjoinEnabled']) => void
  setPayjoinSessionTtlMs: (
    payjoinSessionTtlMs: SettingsState['payjoinSessionTtlMs']
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
      payjoinEnabled: true,
      payjoinSessionTtlMs: PAYJOIN_SESSION_TTL_MS,
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
      setPayjoinEnabled: (payjoinEnabled) => {
        set({ payjoinEnabled })
      },
      setPayjoinSessionTtlMs: (payjoinSessionTtlMs) => {
        set({
          payjoinSessionTtlMs: normalizePayjoinSessionTtlMs(payjoinSessionTtlMs)
        })
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
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SettingsState> | undefined
        const merged = migrateFiatPriceSettings(persisted, {
          ...currentState,
          ...persisted
        })
        merged.payjoinSessionTtlMs = normalizePayjoinSessionTtlMs(
          merged.payjoinSessionTtlMs
        )
        return merged
      },
      name: 'settings-store',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { migrateFiatPriceSettings, useSettingsStore }
export type { FiatPriceProvider }

function getPayjoinSessionTtlMs(): number {
  return normalizePayjoinSessionTtlMs(
    useSettingsStore.getState().payjoinSessionTtlMs
  )
}

export { getPayjoinSessionTtlMs }
