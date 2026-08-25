import { type BdkWallet } from 'react-native-bdk-sdk'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { type Account } from '@/types/models/Account'

type WalletsState = {
  wallets: Record<Account['id'], BdkWallet | undefined>
  /** Filesystem path to the SQLite DB for each wallet — used for rescan/reset */
  dbPaths: Record<Account['id'], string | undefined>
  /** For watch-only address wallets */
  addresses: Record<Account['id'], string | undefined>
}

type WalletsAction = {
  addAccountWallet: (
    accountId: Account['id'],
    wallet: BdkWallet,
    dbPath?: string
  ) => void
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
    addAccountWallet: (accountId, wallet, dbPath) =>
      set((state) => {
        state.wallets[accountId] = wallet
        if (dbPath) {
          state.dbPaths[accountId] = dbPath
        }
      }),
    addresses: {},
    dbPaths: {},
    deleteWallets: () => set({ addresses: {}, dbPaths: {}, wallets: {} }),
    removeAccountWallet: (accountId) =>
      set((state) => {
        delete state.wallets[accountId]
        delete state.dbPaths[accountId]
        delete state.addresses[accountId]
      }),
    wallets: {}
  }))
)

export { useWalletsStore }
