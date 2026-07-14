import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { type BrantaTriggerMode } from '@/types/models/Branta'

type BrantaSettingsState = {
  verificationMode: BrantaTriggerMode
  logoPrefetchMode: BrantaTriggerMode
}

type BrantaSettingsAction = {
  setVerificationMode: (mode: BrantaTriggerMode) => void
  setLogoPrefetchMode: (mode: BrantaTriggerMode) => void
}

const useBrantaSettingsStore = create<
  BrantaSettingsState & BrantaSettingsAction
>()(
  persist(
    (set) => ({
      logoPrefetchMode: 'off',
      setLogoPrefetchMode: (logoPrefetchMode) => {
        set({ logoPrefetchMode })
      },
      setVerificationMode: (verificationMode) => {
        set((state) => ({
          logoPrefetchMode:
            verificationMode === 'off' ? 'off' : state.logoPrefetchMode,
          verificationMode
        }))
      },
      verificationMode: 'off'
    }),
    {
      name: 'branta-settings-store',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useBrantaSettingsStore }
