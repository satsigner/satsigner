import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { queryClient } from '@/lib/queryClient'
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
  setLastSync: (lastSync: string | undefined) => void
  updateLastSync: () => void
}

const initialStatus: LNDConnectionStatus = {
  isConnected: false,
  isConnecting: false
}

// Requests overlap (the dashboard fires several at once), so "connecting"
// lasts until the last one settles, not until the first one does.
let requestsInFlight = 0

export const useLightningStore = create<LightningState>()(
  persist(
    (set) => ({
      clearConfig: () => {
        void deleteLndSecretsSafe()
        queryClient.removeQueries({ queryKey: ['lnd'] })
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
      // A different node starts from nothing: the previous node's channels,
      // info and cached queries must not show under the new one.
      setConfig: (config) => {
        void persistLndSecretsSafe(config)
        set((state) => {
          if (state.config?.url === config.url) {
            return { config }
          }
          queryClient.removeQueries({ queryKey: ['lnd'] })
          return { config, status: initialStatus }
        })
      },
      setConnected: (isConnected) =>
        set((state) => ({
          status: { ...state.status, isConnected, isConnecting: false }
        })),
      setConnecting: (isConnecting) => {
        requestsInFlight = Math.max(
          0,
          requestsInFlight + (isConnecting ? 1 : -1)
        )
        set((state) => ({
          status: { ...state.status, isConnecting: requestsInFlight > 0 }
        }))
      },
      setLastSync: function setLastSync(lastSync) {
        set((state) => ({
          status: { ...state.status, lastSync }
        }))
      },
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
      storage: createJSONStorage(() => mmkvStorage),
      version: 0
    }
  )
)
type LNDConnectionStatus = {
  isConnected: boolean
  isConnecting: boolean
  nodeInfo?: LNDNodeInfo
  channels?: LNDChannel[]
  lastSync?: string
}
