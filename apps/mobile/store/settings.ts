import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

type SettingsState = {
  useZeroPadding: boolean
  showWarning: boolean
}

type SettingsAction = {
  setUseZeroPadding: (useZeroPadding: boolean) => void
  setShowWarning: (showWarning: boolean) => void
}

const useSettingsStore = create<SettingsState & SettingsAction>()(
  persist(
    (set) => ({
      useZeroPadding: false,
      showWarning: true,
      setUseZeroPadding: (useZeroPadding) => {
        set({ useZeroPadding })
      },
      setShowWarning: (showWarning) => {
        set({ showWarning })
      }
    }),
    { name: 'settings-store', storage: createJSONStorage(() => mmkvStorage) }
  )
)

export { useSettingsStore }
