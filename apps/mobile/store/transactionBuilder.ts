import { enableMapSet, produce } from 'immer'
import { create } from 'zustand'

import type { Output } from '@/types/models/Output'
import type { Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/utxo'

enableMapSet()

type TransactionBuilderState = {
  inputs: Map<ReturnType<typeof getUtxoOutpoint>, Utxo>
  outputs: Map<Output['to'], Output['amount']>
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
  inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
  outputs: new Map<Output['to'], Output['amount']>(),
  clearTransaction: () => {
    set({
      inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
      outputs: new Map<Output['to'], Output['amount']>()
    })
  },
  getInputs: () => {
    return Array.from(get().inputs.values())
  },
  hasInput: (utxo) => {
    return get().inputs.has(getUtxoOutpoint(utxo))
  },
  addInput: (utxo) => {
    set(
      produce((state: TransactionBuilderState) => {
        state.inputs.set(getUtxoOutpoint(utxo), utxo)
      })
    )
  },
  removeInput: (utxo) => {
    set(
      produce((state: TransactionBuilderState) => {
        state.inputs.delete(getUtxoOutpoint(utxo))
      })
    )
  }
}))

export { useTransactionBuilderStore }
