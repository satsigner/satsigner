import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

type EnergyState = {
  rpcUrl: string
  rpcUsername: string
  rpcPassword: string
  miningAddress: string
  opReturnContent: string
}

type EnergyAction = {
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
      rpcUrl: '',
      rpcUsername: '',
      rpcPassword: '',
      miningAddress: '',
      opReturnContent: '',
      setRpcUrl: (rpcUrl) => set({ rpcUrl }),
      setRpcUsername: (rpcUsername) => set({ rpcUsername }),
      setRpcPassword: (rpcPassword) => set({ rpcPassword }),
      setMiningAddress: (miningAddress) => set({ miningAddress }),
      setOpReturnContent: (opReturnContent) => set({ opReturnContent }),
      resetEnergyConfig: () =>
        set({
          rpcUrl: '',
          rpcUsername: '',
          rpcPassword: '',
          miningAddress: '',
          opReturnContent: ''
        })
    }),
    {
      name: 'energy-store',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useEnergyStore }
