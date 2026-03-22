import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { DEFAULT_WORD_LIST } from '@/utils/bip39';
import type { WordListName } from '@/utils/bip39';

interface SettingsState {
  mnemonicWordList: WordListName
  useZeroPadding: boolean
  currencyUnit: 'sats' | 'btc'
  showWarning: boolean
  skipSeedConfirmation: boolean
  privacyMode: boolean
}

interface SettingsAction {
  setCurrencyUnit: (currencyUnit: SettingsState['currencyUnit']) => void
  setUseZeroPadding: (useZeroPadding: SettingsState['useZeroPadding']) => void
  setShowWarning: (showWarning: SettingsState['showWarning']) => void
  setSkipSeedConfirmation: (skip: SettingsState['skipSeedConfirmation']) => void
  setMnemonicWordList: (wordList: SettingsState['mnemonicWordList']) => void
  togglePrivacyMode: () => void
}

const useSettingsStore = create<SettingsState & SettingsAction>()(
  persist(
    (set) => ({
      currencyUnit: 'sats',
      mnemonicWordList: DEFAULT_WORD_LIST,
      privacyMode: false,
      setCurrencyUnit: (currencyUnit) => {
        set({ currencyUnit })
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
    { name: 'settings-store', storage: createJSONStorage(() => mmkvStorage) }
  )
)

export { useSettingsStore }
