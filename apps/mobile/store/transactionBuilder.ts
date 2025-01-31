import { PartiallySignedTransaction } from 'bdk-rn'
import { TxBuilderResult } from 'bdk-rn/lib/classes/Bindings'
import { enableMapSet, produce } from 'immer'
import { create } from 'zustand'

import type { Output } from '@/types/models/Output'
import type { Utxo } from '@/types/models/Utxo'
import { generateId } from '@/utils/id'
import { getUtxoOutpoint } from '@/utils/utxo'

enableMapSet()

type TransactionBuilderState = {
  inputs: Map<ReturnType<typeof getUtxoOutpoint>, Utxo>
  outputs: Output[]
  feeRate: number
  txBuilderResult?: TxBuilderResult
  psbt?: PartiallySignedTransaction
}

type TransactionBuilderAction = {
  clearTransaction: () => void
  getInputs: () => Utxo[]
  hasInput: (utxo: Utxo) => boolean
  addInput: (utxo: Utxo) => void
  removeInput: (utxo: Utxo) => void
  addOutput: (output: Omit<Output, 'localId'>) => void
  setFeeRate: (feeRate: number) => void
  setTxBuilderResult: (txBuilderResult: TxBuilderResult) => void
  setPsbt: (pbst: PartiallySignedTransaction) => void
}

const useTransactionBuilderStore = create<
  TransactionBuilderState & TransactionBuilderAction
>()((set, get) => ({
  inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
  outputs: [],
  feeRate: 0,
  clearTransaction: () => {
    set({
      inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
      outputs: [],
      feeRate: 0,
      txBuilderResult: undefined,
      psbt: undefined
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
  },
  addOutput: (output) => {
    set(
      produce((state: TransactionBuilderState) => {
        state.outputs.push({ localId: generateId(), ...output })
      })
    )
  },
  setFeeRate: (feeRate) => {
    set({ feeRate })
  },
  setTxBuilderResult: (txBuilderResult) => {
    set({ txBuilderResult })
  },
  setPsbt: (psbt) => {
    set({ psbt })
  }
}))

export { useTransactionBuilderStore }
