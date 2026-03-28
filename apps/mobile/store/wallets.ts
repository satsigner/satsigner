import { type BdkWallet } from 'react-native-bdk-sdk'
import { produce } from 'immer'
import { create } from 'zustand'

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

const useWalletsStore = create<WalletsState & WalletsAction>((set) => ({
  addAccountAddress: (accountId, address) =>
    set(
      produce((state) => {
        state.addresses[accountId] = address
      })
    ),
  addAccountWallet: (accountId, wallet) =>
    set(
      produce((state) => {
        state.wallets[accountId] = wallet
      })
    ),
  addresses: {},
  deleteWallets: () => set({ addresses: {}, wallets: {} }),
  removeAccountWallet: (accountId) =>
    set(
      produce((state) => {
        delete state.wallets[accountId]
        delete state.addresses[accountId]
      })
    ),
  wallets: {}
}))

export { useWalletsStore }
