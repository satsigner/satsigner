import { create } from 'zustand'

import { generateMnemonic } from '@/api/bdk'
import { type Account } from '@/types/models/Account'

type AccountsState = {
  accounts: Account[]
  currentAccount: Account
}

type AccountsAction = {
  generateMnemonic: (
    count: NonNullable<Account['seedWordCount']>
  ) => Promise<void>
}

const useAccountStore = create<AccountsState & AccountsAction>()((set) => ({
  accounts: [],
  currentAccount: { name: '', accountCreationType: null },
  generateMnemonic: async (count) => {
    const mnemonic = await generateMnemonic(count)
    set((state) => ({
      currentAccount: { ...state.currentAccount, seedWords: mnemonic }
    }))
  }
}))

export { useAccountStore }
