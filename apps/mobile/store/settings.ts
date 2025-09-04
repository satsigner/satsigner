import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { DEFAULT_WORD_LIST, type WordList } from '@/utils/bip39'

type SettingsState = {
  mnemonicWordList: WordList
  useZeroPadding: boolean
  showWarning: boolean
  skipSeedConfirmation: boolean
}

type SettingsAction = {
  setUseZeroPadding: (useZeroPadding: SettingsState['useZeroPadding']) => void
  setShowWarning: (showWarning: SettingsState['showWarning']) => void
  setSkipSeedConfirmation: (skip: SettingsState['skipSeedConfirmation']) => void
  setMnemonicWordList: (wordList: SettingsState['mnemonicWordList']) => void
}

const useSettingsStore = create<SettingsState & SettingsAction>()(
  persist(
    (set) => ({
      useZeroPadding: false,
      showWarning: true,
      skipSeedConfirmation: true,
      mnemonicWordList: DEFAULT_WORD_LIST,
      setUseZeroPadding: (useZeroPadding) => {
        set({ useZeroPadding })
      },
      setMnemonicWordList: (mnemonicWordList) => {
        set({ mnemonicWordList })
      },
      setShowWarning: (showWarning) => {
        set({ showWarning })
      },
      setSkipSeedConfirmation: (skipSeedConfirmation) => {
        set({ skipSeedConfirmation })
      }
    }),
    { name: 'settings-store', storage: createJSONStorage(() => mmkvStorage) }
  )
)

export { useSettingsStore }
