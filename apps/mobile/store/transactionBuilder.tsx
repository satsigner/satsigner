import { create } from 'zustand'

import { Utxo } from '@/types/models/Utxo'

type TransactionBuilderState = {
  inputs: Utxo[]
}

type TransactionBuilderAction = {
  hasInput: (utxo: Utxo) => boolean
  addInput: (utxo: Utxo) => void
  removeInput: (utxo: Utxo) => void
}

const useTransactionBuilderStore = create<
  TransactionBuilderState & TransactionBuilderAction
>()((set, get) => ({
  inputs: [],
  hasInput: (utxo) => {
    return get().inputs.includes(utxo)
  },
  addInput: (utxo) => {
    set({ inputs: [...get().inputs, utxo] })
  },
  removeInput: (utxo) => {
    set({
      inputs: [...get().inputs.filter((currentUtxo) => currentUtxo !== utxo)]
    })
  }
}))

export { useTransactionBuilderStore }
