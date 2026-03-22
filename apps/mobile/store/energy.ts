import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

interface EnergyState {
  rpcUrl: string
  rpcUsername: string
  rpcPassword: string
  miningAddress: string
  opReturnContent: string
}

interface EnergyAction {
  setRpcUrl: (rpcUrl: string) => void
  setRpcUsername: (rpcUsername: string) => void
  setRpcPassword: (rpcPassword: string) => void
  setMiningAddress: (miningAddress: string) => void
  setOpReturnContent: (opReturnContent: string) => void
  resetEnergyConfig: () => void
}

const useEnergyStore = create<EnergyState & EnergyAction>()(
  persist(
    (set) => ({
      miningAddress: '',
      opReturnContent: '',
      resetEnergyConfig: () =>
        set({
          rpcUrl: '',
          rpcUsername: '',
          rpcPassword: '',
          miningAddress: '',
          opReturnContent: ''
        }),
      rpcPassword: '',
      rpcUrl: '',
      rpcUsername: '',
      setMiningAddress: (miningAddress) => set({ miningAddress }),
      setOpReturnContent: (opReturnContent) => set({ opReturnContent }),
      setRpcPassword: (rpcPassword) => set({ rpcPassword }),
      setRpcUrl: (rpcUrl) => set({ rpcUrl }),
      setRpcUsername: (rpcUsername) => set({ rpcUsername })
    }),
    {
      name: 'energy-store',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useEnergyStore }
