import { create } from 'zustand'

import { type Account } from '@/types/models/Account'

interface AccountsState {
  accounts: Account[]
  currentAccount: Account
}

const useAccountStore = create<AccountsState>()(() => ({
  accounts: [],
  currentAccount: { name: '', accountCreationType: null }
}))

export { useAccountStore }
