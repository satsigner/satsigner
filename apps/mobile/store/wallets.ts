import { type Wallet } from 'bdk-rn'
import { produce } from 'immer'
import { create } from 'zustand'

import { type Account } from '@/types/models/Account'

type WalletsState = {
  wallets: Record<Account['id'], Wallet | undefined>
}

type WalletsAction = {
  addAccountWallet: (accountId: Account['id'], wallet: Wallet) => void
  removeAccountWallet: (accountId: Account['id']) => void
  deleteWallets: () => void
}

const useWalletsStore = create<WalletsState & WalletsAction>((set) => ({
  wallets: {},
  addAccountWallet: (accountId, wallet) =>
    set(
      produce((state) => {
        state.wallets[accountId] = wallet
      })
    ),
  removeAccountWallet: (accountId) =>
    set(
      produce((state) => {
        delete state.wallets[accountId]
      })
    ),
  deleteWallets: () => set({ wallets: {} })
}))

export { useWalletsStore }
