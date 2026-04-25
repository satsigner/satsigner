import { create } from 'zustand'

import type { ArkAccount, ArkServerId } from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'
import { randomKey } from '@/utils/crypto'

type ArkAccountBuilderState = {
  name: string
  network: Network
  serverId: ArkServerId
  /** Selected existing on-chain singlesig Bitcoin account. */
  bitcoinAccountId: string | null
  /** When true, creation flow will auto-create a fresh on-chain wallet. */
  createBitcoinAccount: boolean
}

type ArkAccountBuilderAction = {
  setName: (name: string) => void
  setNetwork: (network: Network) => void
  setServerId: (serverId: ArkServerId) => void
  setBitcoinAccountId: (id: string | null) => void
  setCreateBitcoinAccount: (create: boolean) => void
  getAccountData: () => Promise<ArkAccount>
  clearAccount: () => void
}

const initialState: ArkAccountBuilderState = {
  bitcoinAccountId: null,
  createBitcoinAccount: false,
  name: '',
  network: 'signet',
  serverId: 'second'
}

export const useArkAccountBuilderStore = create<
  ArkAccountBuilderState & ArkAccountBuilderAction
>()((set, get) => ({
  ...initialState,
  clearAccount: () => set(initialState),
  getAccountData: async () => {
    const state = get()
    const id = await randomKey(12)
    return {
      bitcoinAccountId: state.bitcoinAccountId,
      createdAt: new Date().toISOString(),
      id,
      name: state.name.trim() || 'My Ark Wallet',
      network: state.network,
      serverId: state.serverId
    }
  },
  setBitcoinAccountId: (bitcoinAccountId) => set({ bitcoinAccountId }),
  setCreateBitcoinAccount: (createBitcoinAccount) =>
    set({ createBitcoinAccount }),
  setName: (name) => set({ name }),
  setNetwork: (network) => set({ network }),
  setServerId: (serverId) => set({ serverId })
}))
