import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

type SettingsState = {
  useZeroPadding: boolean
}

type SettingsAction = {
  setUseZeroPadding: (useZeroPadding: boolean) => void
}

const useSettingsStore = create<SettingsState & SettingsAction>()(
  persist(
    (set) => ({
      useZeroPadding: false,
      setUseZeroPadding: (useZeroPadding) => {
        set({ useZeroPadding })
      }
    }),
    { name: 'settings-store', storage: createJSONStorage(() => mmkvStorage) }
  )
)

export { useSettingsStore }
