import { Descriptor, Wallet } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  generateMnemonic,
  getFingerprint,
  getWalletData,
  getWalletFromDescriptor,
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
  hasAccountWithName: (name: string) => boolean
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
  loadWalletFromDescriptor: (
    externalDescriptor: Descriptor,
    internalDescriptor: Descriptor
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
      hasAccountWithName: (name) => {
        return !!get().accounts.find((account) => account.name === name)
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
        const { network } = useBlockchainStore.getState()
        const {
          fingerprint,
          derivationPath,
          externalDescriptor,
          internalDescriptor,
          wallet
        } = await getWalletFromMnemonic(
          seedWords,
          scriptVersion,
          passphrase,
          network as Network
        )
        set((state) => ({
          currentAccount: {
            ...state.currentAccount,
            fingerprint,
            derivationPath,
            externalDescriptor,
            internalDescriptor
          }
        }))
        return wallet
      },
      loadWalletFromDescriptor: async (
        externalDescriptor,
        internalDescriptor
      ) => {
        const { network } = useBlockchainStore.getState()

        const wallet = getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network as Network
        )
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
          accounts: [
            ...state.accounts,
            { ...get().currentAccount, ...account }
          ],
          currentAccount: { ...state.currentAccount, ...account }
        }))
      },
      updateAccount: async (account) => {
        const accounts = get().accounts
        const toUpdateAccountIndex = accounts.findIndex(
          (currentAccount) => currentAccount.name === account.name
        )
        if (toUpdateAccountIndex >= 0)
          accounts[toUpdateAccountIndex] = {
            ...get().currentAccount,
            ...account
          }

        set(() => ({
          accounts,
          currentAccount: { ...get().currentAccount, ...account }
        }))
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
