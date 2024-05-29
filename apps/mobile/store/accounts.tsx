import { Wallet } from 'bdk-rn'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  generateMnemonic,
  getFingerprint,
  getWalletData,
  getWalletFromMnemonic,
  syncWallet,
  validateMnemonic
} from '@/api/bdk'
import { getBlockchainConfig } from '@/config/servers'
import mmkvStorage from '@/storage/mmkv'
import { type Account } from '@/types/models/Account'

import { useBlockchainStore } from './blockchain'

type AccountsState = {
  accounts: Account[]
  currentAccount: Account
}

type AccountsAction = {
  resetCurrentAccount: () => void
  generateMnemonic: (
    count: NonNullable<Account['seedWordCount']>
  ) => Promise<void>
  validateMnemonic: (
    seedWords: NonNullable<Account['seedWords']>
  ) => Promise<boolean>
  updateFingerprint: (
    seedWords: NonNullable<Account['seedWords']>,
    passphrase?: Account['passphrase']
  ) => Promise<void>
  loadWalletFromMnemonic: (
    seedWords: NonNullable<Account['seedWords']>,
    scriptVersion: NonNullable<Account['scriptVersion']>,
    passphrase?: Account['passphrase']
  ) => Promise<Wallet>
  syncWallet: (wallet: Wallet) => Promise<void>
  getPopulatedAccount: (wallet: Wallet, account: Account) => Promise<Account>
  saveAccount: (account: Account) => Promise<void>
  updateAccount: (account: Account) => Promise<void>
  deleteAccounts: () => Promise<void>
}

const initialCurrentAccountState: Account = {
  name: '',
  accountCreationType: null,
  transactions: [],
  utxos: [],
  summary: {
    balance: 0,
    numberOfAddresses: 0,
    numberOfTransactions: 0,
    numberOfUtxos: 0,
    satsInMempool: 0
  }
}

const useAccountStore = create<AccountsState & AccountsAction>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentAccount: initialCurrentAccountState,
      resetCurrentAccount: () => {
        set({ currentAccount: initialCurrentAccountState })
      },
      generateMnemonic: async (count) => {
        const mnemonic = await generateMnemonic(count)
        set((state) => ({
          currentAccount: { ...state.currentAccount, seedWords: mnemonic }
        }))
        await get().updateFingerprint(mnemonic)
      },
      validateMnemonic: async (seedWords) => {
        const isValid = await validateMnemonic(seedWords)
        return isValid
      },
      updateFingerprint: async (seedWords, passphrase) => {
        const fingerprint = await getFingerprint(seedWords, passphrase)
        set((state) => ({
          currentAccount: { ...state.currentAccount, fingerprint }
        }))
      },
      loadWalletFromMnemonic: async (seedWords, scriptVersion, passphrase) => {
        const { fingerprint, derivationPath, wallet } =
          await getWalletFromMnemonic(seedWords, scriptVersion, passphrase)
        set((state) => ({
          currentAccount: {
            ...state.currentAccount,
            fingerprint,
            derivationPath
          }
        }))
        return wallet
      },
      syncWallet: async (wallet) => {
        const { backend, url } = useBlockchainStore.getState()

        await syncWallet(wallet, backend, getBlockchainConfig(backend, url))
      },
      getPopulatedAccount: async (wallet, account) => {
        const { transactions, utxos, summary } = await getWalletData(wallet)
        return { ...account, transactions, utxos, summary }
      },
      saveAccount: async (account) => {
        set((state) => ({
          accounts: [...state.accounts, account],
          currentAccount: { ...state.currentAccount, ...account }
        }))
      },
      updateAccount: async (account) => {
        // TODO
      },
      deleteAccounts: async () => {
        set(() => ({
          accounts: [],
          currentAccount: initialCurrentAccountState
        }))
      }
    }),
    {
      name: 'satsigner-accounts',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountStore }
