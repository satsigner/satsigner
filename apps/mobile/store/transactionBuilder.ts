import { type PartiallySignedTransaction } from 'bdk-rn'
import { type TxBuilderResult } from 'bdk-rn/lib/classes/Bindings'
import { enableMapSet, produce } from 'immer'
import { create } from 'zustand'

import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { randomUuid } from '@/utils/crypto'
import { getUtxoOutpoint } from '@/utils/utxo'

enableMapSet()

type TransactionBuilderState = {
  inputs: Map<ReturnType<typeof getUtxoOutpoint>, Utxo>
  outputs: Output[]
  feeRate: number
  fee: number
  timeLock: number
  rbf: boolean
  cpfp: boolean
  txBuilderResult?: TxBuilderResult
  psbt?: PartiallySignedTransaction
  signedTx?: string
  signedPsbts: Map<number, string>
  broadcasted: boolean
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
  setSignedTx: (
    signedTx: NonNullable<TransactionBuilderState['signedTx']>
  ) => void
  setSignedPsbts: (signedPsbts: TransactionBuilderState['signedPsbts']) => void
  setBroadcasted: (broadcasted: boolean) => void
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
  broadcasted: false,
  signedPsbts: new Map<number, string>(),
  clearTransaction: () => {
    set({
      inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
      outputs: [],
      feeRate: 0,
      txBuilderResult: undefined,
      psbt: undefined,
      signedTx: undefined,
      broadcasted: false,
      signedPsbts: new Map<number, string>()
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
        state.outputs.push({ localId: randomUuid(), ...output })
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
  },
  setSignedTx: (signedTx) => {
    set({ signedTx })
  },
  setSignedPsbts: (signedPsbts) => {
    set({ signedPsbts })
  },
  setBroadcasted: (broadcasted) => {
    set({ broadcasted })
  }
}))

export { useTransactionBuilderStore }
