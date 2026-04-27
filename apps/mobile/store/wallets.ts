import { type BdkWallet } from 'react-native-bdk-sdk'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { type Account } from '@/types/models/Account'

type WalletsState = {
  wallets: Record<Account['id'], BdkWallet | undefined>
  /** For watch-only address wallets */
  addresses: Record<Account['id'], string | undefined>
}

type WalletsAction = {
  addAccountWallet: (accountId: Account['id'], wallet: BdkWallet) => void
  removeAccountWallet: (accountId: Account['id']) => void
  deleteWallets: () => void
  addAccountAddress: (accountId: Account['id'], address: string) => void
}

const useWalletsStore = create<WalletsState & WalletsAction>()(
  immer((set) => ({
    addAccountAddress: (accountId, address) =>
      set((state) => {
        state.addresses[accountId] = address
      }),
    addAccountWallet: (accountId, wallet) =>
      set((state) => {
        state.wallets[accountId] = wallet
      }),
    addresses: {},
    deleteWallets: () => set({ addresses: {}, wallets: {} }),
    removeAccountWallet: (accountId) =>
      set((state) => {
        delete state.wallets[accountId]
        delete state.addresses[accountId]
      }),
    wallets: {}
  }))
)

export { useWalletsStore }
