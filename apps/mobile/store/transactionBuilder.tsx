import { create } from 'zustand'

import { Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/utxo'

type TransactionBuilderState = {
  inputs: Map<string, Utxo>
}

type TransactionBuilderAction = {
  clearTransaction: () => void
  getInputs: () => Utxo[]
  hasInput: (utxo: Utxo) => boolean
  addInput: (utxo: Utxo) => void
  removeInput: (utxo: Utxo) => void
}

const useTransactionBuilderStore = create<
  TransactionBuilderState & TransactionBuilderAction
>()((set, get) => ({
  inputs: new Map<string, Utxo>(),
  clearTransaction: () => {
    set({ inputs: new Map<string, Utxo>() })
  },
  getInputs: () => {
    return Array.from(get().inputs.values())
  },
  hasInput: (utxo) => {
    return get().inputs.has(getUtxoOutpoint(utxo))
  },
  addInput: (utxo) => {
    const newMap = get().inputs
    const key = getUtxoOutpoint(utxo)
    newMap.set(key, utxo)
    set({ inputs: newMap })
  },
  removeInput: (utxo) => {
    const newMap = get().inputs
    const key = getUtxoOutpoint(utxo)
    newMap.delete(key)
    set({ inputs: newMap })
  }
}))

export { useTransactionBuilderStore }
