import { create } from 'zustand'

import type { EcashAccount } from '@/types/models/Ecash'
import { ACCOUNT_ID_KEY_LENGTH, randomKey } from '@/utils/crypto'

type EcashAccountBuilderState = {
  name: string
  mnemonic: string
  importMode: boolean
}

type EcashAccountBuilderAction = {
  setName: (name: string) => void
  setMnemonic: (mnemonic: string) => void
  setImportMode: (importMode: boolean) => void
  getAccountData: () => Promise<EcashAccount>
  clearAccount: () => void
}

const initialState: EcashAccountBuilderState = {
  importMode: false,
  mnemonic: '',
  name: ''
}

export const useEcashAccountBuilderStore = create<
  EcashAccountBuilderState & EcashAccountBuilderAction
>()((set, get) => ({
  ...initialState,
  clearAccount: () => set(initialState),
  getAccountData: async () => {
    const state = get()
    const id = await randomKey(ACCOUNT_ID_KEY_LENGTH)
    return {
      createdAt: new Date().toISOString(),
      hasSeed: state.mnemonic.trim().length > 0,
      id,
      name: state.name.trim() || 'Ecash Account'
    }
  },
  setImportMode: (importMode) => set({ importMode }),
  setMnemonic: (mnemonic) => set({ mnemonic }),
  setName: (name) => set({ name })
}))
