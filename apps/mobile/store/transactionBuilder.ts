import { type PartiallySignedTransaction } from 'bdk-rn'
import { type TxBuilderResult } from 'bdk-rn/lib/classes/Bindings'
import { enableMapSet, produce } from 'immer'
import uuid from 'react-native-uuid'
import { create } from 'zustand'

import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/utxo'

enableMapSet()

type TransactionBuilderState = {
  inputs: Map<ReturnType<typeof getUtxoOutpoint>, Utxo>
  outputs: Output[]
  feeRate: number
  fee: number
  timeLock: number
  rbf: boolean
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
  updateOutput: (
    localId: Output['localId'],
    output: Omit<Output, 'localId'>
  ) => void
  removeOutput: (localId: Output['localId']) => void
  setFeeRate: (feeRate: TransactionBuilderState['feeRate']) => void
  setFee: (fee: TransactionBuilderState['fee']) => void
  setRbf: (rbf: TransactionBuilderState['rbf']) => void
  setTxBuilderResult: (
    txBuilderResult: NonNullable<TransactionBuilderState['txBuilderResult']>
  ) => void
  setPsbt: (pbst: NonNullable<TransactionBuilderState['psbt']>) => void
}

const useTransactionBuilderStore = create<
  TransactionBuilderState & TransactionBuilderAction
>()((set, get) => ({
  inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
  outputs: [],
  feeRate: 0,
  fee: 0,
  timeLock: 0,
  rbf: true,
  cpfp: true,
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
        state.outputs.push({ localId: uuid.v4(), ...output })
      })
    )
  },
  updateOutput: (localId, output) => {
    set(
      produce((state: TransactionBuilderState) => {
        const index = state.outputs.findIndex(
          (output) => output.localId === localId
        )
        if (index !== -1) state.outputs[index] = { localId, ...output }
      })
    )
  },
  removeOutput: (localId) => {
    set(
      produce((state: TransactionBuilderState) => {
        const index = state.outputs.findIndex(
          (output) => output.localId === localId
        )
        if (index !== -1) state.outputs.splice(index, 1)
      })
    )
  },
  setFee: (fee) => {
    set({ fee })
  },
  setFeeRate: (feeRate) => {
    set({ feeRate })
  },
  setRbf: (rbf) => {
    set({ rbf })
  },
  setTxBuilderResult: (txBuilderResult) => {
    set({ txBuilderResult })
  },
  setPsbt: (psbt) => {
    set({ psbt })
  }
}))

export { useTransactionBuilderStore }
