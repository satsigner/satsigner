import { Descriptor, Wallet } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getWalletData, getWalletFromDescriptor, syncWallet } from '@/api/bdk'
import { getBlockchainConfig } from '@/config/servers'
import mmkvStorage from '@/storage/mmkv'
import { type Account } from '@/types/models/Account'

import { useBlockchainStore } from './blockchain'

type AccountsState = {
  accounts: Account[]
}

type AccountsAction = {
  getAllAccounts: () => Account[]
  getCurrentAccount: (name: string) => Account
  hasAccountWithName: (name: string) => boolean
  loadWalletFromDescriptor: (
    externalDescriptor: Descriptor,
    internalDescriptor: Descriptor
  ) => Promise<Wallet>
  syncWallet: (wallet: Wallet, account: Account) => Promise<Account>
  addAccount: (account: Account) => void
  updateAccount: (account: Account) => void
  deleteAccounts: () => void
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  persist(
    (set, get) => ({
      accounts: [],
      getAllAccounts: () => {
        return get().accounts
      },
      addAccount: (account) => {
        set(
          produce((state: AccountsState) => {
            state.accounts.push(account)
          })
        )
      },
      hasAccountWithName: (name) =>
        get().accounts.find((account) => account.name === name) !== undefined,
      getCurrentAccount: (name) =>
        get().accounts.find((account) => account.name === name)!,
      loadWalletFromDescriptor: async (
        externalDescriptor,
        internalDescriptor
      ) => {
        const { network } = useBlockchainStore.getState()
        return getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network as Network
        )
      },
      syncWallet: async (wallet, account) => {
        const { backend, network, retries, stopGap, timeout, url } =
          useBlockchainStore.getState()
        const opts = { retries, stopGap, timeout }

        await syncWallet(
          wallet,
          backend,
          getBlockchainConfig(backend, url, opts)
        )
        const { transactions, utxos, summary } = await getWalletData(
          wallet,
          network as Network
        )
        return { ...account, transactions, utxos, summary }
      },
      updateAccount: (account) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (_account) => _account.name === account.name
            )
            if (index !== -1) state.accounts[index] = account
          })
        )
      },
      deleteAccounts: () => {
        set(() => ({ accounts: [] }))
      }
    }),
    {
      name: 'satsigner-accounts',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountsStore }
