import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

export interface LNDConfig {
  macaroon: string
  cert: string
  url: string
}

export interface LNDNodeInfo {
  version: string
  commit_hash: string
  identity_pubkey: string
  alias: string
  num_active_channels: number
  num_peers: number
  block_height: number
  block_hash: string
  best_header_timestamp: string
  synced_to_chain: boolean
  chains: string[]
  uris: string[]
}

export interface LNDChannel {
  active: boolean
  remote_pubkey: string
  channel_point: string
  chan_id: string
  capacity: number
  local_balance: number
  remote_balance: number
  commit_fee: number
  commit_weight: number
  fee_per_kw: number
  unsettled_balance: number
  total_satoshis_sent: number
  total_satoshis_received: number
  num_updates: number
  pending_htlcs: any[]
  csv_delay: number
  private: boolean
  initiator: boolean
  chan_status_flags: string
  local_chan_reserve_sat: number
  remote_chan_reserve_sat: number
  static_remote_key: boolean
  commitment_type: string
  lifetime: number
  uptime: number
  close_address: string
  push_amount_sat: number
  thaw_height: number
  local_constraints: {
    csv_delay: number
    chan_reserve_sat: number
    dust_limit_sat: number
    max_pending_amt_msat: number
    min_htlc_msat: number
    max_accepted_htlcs: number
  }
  remote_constraints: {
    csv_delay: number
    chan_reserve_sat: number
    dust_limit_sat: number
    max_pending_amt_msat: number
    min_htlc_msat: number
    max_accepted_htlcs: number
  }
}

export interface ConnectionStatus {
  isConnected: boolean
  isConnecting: boolean
  lastError?: string
  nodeInfo?: LNDNodeInfo
  channels?: LNDChannel[]
  lastSync?: string
}

interface LightningState {
  config: LNDConfig | null
  status: ConnectionStatus
  setConfig: (config: LNDConfig) => void
  clearConfig: () => void
  setConnecting: (isConnecting: boolean) => void
  setConnected: (isConnected: boolean) => void
  setError: (error?: string) => void
  setNodeInfo: (info: LNDNodeInfo) => void
  setChannels: (channels: LNDChannel[]) => void
  updateLastSync: () => void
}

const initialStatus: ConnectionStatus = {
  isConnected: false,
  isConnecting: false
}

export const useLightningStore = create<LightningState>()(
  persist(
    (set) => ({
      config: null,
      status: initialStatus,
      setConfig: (config) => set({ config }),
      clearConfig: () =>
        set({
          config: null,
          status: initialStatus
        }),
      setConnecting: (isConnecting) =>
        set((state) => ({
          status: { ...state.status, isConnecting }
        })),
      setConnected: (isConnected) =>
        set((state) => ({
          status: { ...state.status, isConnected, isConnecting: false }
        })),
      setError: (error) =>
        set((state) => ({
          status: { ...state.status, lastError: error }
        })),
      setNodeInfo: (nodeInfo) =>
        set((state) => ({
          status: { ...state.status, nodeInfo }
        })),
      setChannels: (channels) =>
        set((state) => ({
          status: { ...state.status, channels }
        })),
      updateLastSync: () =>
        set((state) => ({
          status: { ...state.status, lastSync: new Date().toISOString() }
        }))
    }),
    {
      name: 'satsigner-lightning',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        config: state.config,
        status: {
          isConnected: state.status.isConnected,
          nodeInfo: state.status.nodeInfo,
          channels: state.status.channels,
          lastSync: state.status.lastSync
        }
      })
    }
  )
)
