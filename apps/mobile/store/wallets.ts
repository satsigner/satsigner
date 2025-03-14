import { type Wallet } from 'bdk-rn'
import { produce } from 'immer'
import { create } from 'zustand'

import { type Account } from '@/types/models/Account'

type WalletsState = {
  wallets: Record<Account['id'], Wallet | undefined>
  /** For watch-only address wallets */
  addresses: Record<Account['id'], string | undefined>
}

type WalletsAction = {
  addAccountWallet: (accountId: Account['id'], wallet: Wallet) => void
  removeAccountWallet: (accountId: Account['id']) => void
  deleteWallets: () => void
  addAccountAddress: (accountId: Account['id'], address: string) => void
}

const useWalletsStore = create<WalletsState & WalletsAction>((set) => ({
  wallets: {},
  addresses: {},
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
        delete state.addresses[accountId]
      })
    ),
  deleteWallets: () => set({ wallets: {}, addresses: {} }),
  addAccountAddress: (accountId, address) =>
    set(
      produce((state) => {
        state.addresses[accountId] = address
      })
    )
}))

export { useWalletsStore }
