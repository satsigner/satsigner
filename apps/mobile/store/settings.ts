import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

type SettingsState = {
  useZeroPadding: boolean
}

type SettingsAction = {
  setUseZeroPadding: (state: boolean) => void
}

const useSettingsStore = create<SettingsState & SettingsAction>()(
  persist(
    (set) => ({
      useZeroPadding: false,

      setUseZeroPadding: (data) => {
        set(
          produce((state: SettingsState) => {
            state.useZeroPadding = data
          })
        )
      }
    }),
    { name: 'settings-store', storage: createJSONStorage(() => mmkvStorage) }
  )
)

export { useSettingsStore }
