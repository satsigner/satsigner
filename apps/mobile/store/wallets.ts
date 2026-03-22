import type { Wallet } from 'bdk-rn'
import { produce } from 'immer'
import { create } from 'zustand'

import type { Account } from '@/types/models/Account'

interface WalletsState {
  wallets: Record<Account['id'], Wallet | undefined>
  /** For watch-only address wallets */
  addresses: Record<Account['id'], string | undefined>
}

interface WalletsAction {
  addAccountWallet: (accountId: Account['id'], wallet: Wallet) => void
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
  deleteWallets: () => set({ wallets: {}, addresses: {} }),
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
