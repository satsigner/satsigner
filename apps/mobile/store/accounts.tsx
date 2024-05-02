import { create } from 'zustand'

import { generateMnemonic, getFingerprint, validateMnemonic } from '@/api/bdk'
import { type Account } from '@/types/models/Account'

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
    }
  })
)

export { useAccountStore }
