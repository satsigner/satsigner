import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import type {
  LNDChannel,
  LNDConfig,
  LNDConnectionStatus,
  LNDNodeInfo
} from '@/types/models/LND'

interface LightningState {
  config: LNDConfig | null
  status: LNDConnectionStatus
  setConfig: (config: LNDConfig) => void
  clearConfig: () => void
  setConnecting: (isConnecting: boolean) => void
  setConnected: (isConnected: boolean) => void
  setNodeInfo: (info: LNDNodeInfo) => void
  setChannels: (channels: LNDChannel[]) => void
  updateLastSync: () => void
}

const initialStatus: LNDConnectionStatus = {
  isConnected: false,
  isConnecting: false
}

export const useLightningStore = create<LightningState>()(
  persist(
    (set) => ({
      clearConfig: () =>
        set({
          config: null,
          status: initialStatus
        }),
      config: null,
      setChannels: (channels) =>
        set((state) => ({
          status: { ...state.status, channels }
        })),
      setConfig: (config) => set({ config }),
      setConnected: (isConnected) =>
        set((state) => ({
          status: { ...state.status, isConnected, isConnecting: false }
        })),
      setConnecting: (isConnecting) =>
        set((state) => ({
          status: { ...state.status, isConnecting }
        })),
      setNodeInfo: (nodeInfo) =>
        set((state) => ({
          status: { ...state.status, nodeInfo }
        })),
      status: initialStatus,
      updateLastSync: () =>
        set((state) => ({
          status: { ...state.status, lastSync: new Date().toISOString() }
        }))
    }),
    {
      name: 'satsigner-lightning',
      partialize: (state) => ({
        config: state.config,
        status: {
          isConnected: state.status.isConnected,
          nodeInfo: state.status.nodeInfo,
          channels: state.status.channels,
          lastSync: state.status.lastSync
        }
      }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)
