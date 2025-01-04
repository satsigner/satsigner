import { Descriptor, Wallet } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import crypto from 'react-native-aes-crypto'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getWalletData, getWalletFromDescriptor, syncWallet } from '@/api/bdk'
import { getBlockchainConfig } from '@/config/servers'
import { getItem } from '@/storage/encrypted'
import mmkvStorage from '@/storage/mmkv'
import { type Account } from '@/types/models/Account'

import { useBlockchainStore } from './blockchain'
const PIN_KEY = 'satsigner_pin'

type AccountsState = {
  accounts: any
  allAccounts: string[]
}

type AccountsAction = {
  getAllAccounts: () => Promise<Account[] | undefined>
  getCurrentAccount: (name: string) => Promise<Account | undefined>
  hasAccountWithName: (name: string) => boolean
  loadWalletFromDescriptor: (
    externalDescriptor: Descriptor,
    internalDescriptor: Descriptor
  ) => Promise<Wallet>
  syncWallet: (wallet: Wallet, account: Account) => Promise<Account>
  addAccount: (account: Account) => Promise<void>
  updateAccount: (account: Account) => Promise<void>
  deleteAccounts: () => void
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  persist(
    (set, get) => ({
      accounts: {},
      allAccounts: [],
      getAllAccounts: async () => {
        const pin = await getItem(PIN_KEY)
        const accounts = get().allAccounts
        const decryptedAccounts: Account[] = []
        for (let i = 0; i < accounts.length; i++) {
          const decryptedAcount = await crypto.decrypt(
            accounts[i],
            pin!,
            '',
            'aes-256-cbc'
          )
          const account = JSON.parse(decryptedAcount)
          decryptedAccounts.push(account as Account)
        }
        return decryptedAccounts
      },
      addAccount: async (account) => {
        const pin = await getItem(PIN_KEY)
        const encryptedAccount = await crypto.encrypt(
          JSON.stringify(account),
          pin!,
          '',
          'aes-256-cbc'
        )
        set((state) => ({
          accounts: { ...state.accounts, [account.name]: encryptedAccount },
          allAccounts: [...state.allAccounts, encryptedAccount]
        }))
      },
      hasAccountWithName: (name) => get().accounts[name] !== undefined,
      getCurrentAccount: async (name) => {
        const pin = await getItem(PIN_KEY)
        const encryptedAccount: string = get().accounts[name]
        if (encryptedAccount.length > 0) {
          return JSON.parse(
            await crypto.decrypt(encryptedAccount, pin!, '', 'aes-256-cbc')
          ) as Account
        }
        return undefined
      },
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
      updateAccount: async (account) => {
        const pin = await getItem(PIN_KEY)
        const encryptedAccount = await crypto.encrypt(
          JSON.stringify(account),
          pin!,
          '',
          'aes-256-cbc'
        )
        set((state) => {
          return {
            accounts: { ...state.accounts, [account.name]: encryptedAccount }
          }
        })
      },
      deleteAccounts: () => {
        set(() => ({ accounts: {}, allAccounts: [] }))
      }
    }),
    {
      name: 'satsigner-accounts',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountsStore }
