import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import type {
  LNDChannel,
  LNDConfig,
  LNDNodeInfo
} from '@/types/models/Lightning'
import {
  deleteLndSecretsSafe,
  persistLndSecretsSafe,
  stripLndSecrets
} from '@/utils/serviceSecrets'

type LightningState = {
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
      clearConfig: () => {
        void deleteLndSecretsSafe()
        set({
          config: null,
          status: initialStatus
        })
      },
      config: null,
      setChannels: (channels) =>
        set((state) => ({
          status: { ...state.status, channels }
        })),
      setConfig: (config) => {
        void persistLndSecretsSafe(config)
        set({ config })
      },
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
        config: state.config ? stripLndSecrets(state.config) : null,
        status: {
          channels: state.status.channels,
          isConnected: state.status.isConnected,
          lastSync: state.status.lastSync,
          nodeInfo: state.status.nodeInfo
        }
      }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)
export type LNDConnectionStatus = {
  isConnected: boolean
  isConnecting: boolean
  nodeInfo?: LNDNodeInfo
  channels?: LNDChannel[]
  lastSync?: string
}
