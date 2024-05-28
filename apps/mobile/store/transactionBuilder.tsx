import { create } from 'zustand'

import { Utxo } from '@/types/models/Utxo'

type TransactionBuilderState = {
  inputs: Set<Utxo>
}

type TransactionBuilderAction = {
  hasInput: (utxo: Utxo) => boolean
  addInput: (utxo: Utxo) => void
  removeInput: (utxo: Utxo) => void
}

const useTransactionBuilderStore = create<
  TransactionBuilderState & TransactionBuilderAction
>()((set, get) => ({
  inputs: new Set(),
  hasInput: (utxo) => {
    return get().inputs.has(utxo)
  },
  addInput: (utxo) => {
    set({ inputs: new Set([...get().inputs, utxo]) })
  },
  removeInput: (utxo) => {
    set({
      inputs: new Set(
        [...get().inputs].filter((currentUtxo) => currentUtxo !== utxo)
      )
    })
  }
}))

export { useTransactionBuilderStore }
