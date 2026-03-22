import type { PartiallySignedTransaction } from 'bdk-rn'
import type { TxBuilderResult } from 'bdk-rn/lib/classes/Bindings'
import { enableMapSet, produce } from 'immer'
import { create } from 'zustand'

import type { Output } from '@/types/models/Output'
import type { Utxo } from '@/types/models/Utxo'
import { randomUuid } from '@/utils/crypto'
import { getUtxoOutpoint } from '@/utils/utxo'

enableMapSet()

interface TransactionBuilderState {
  accountId?: string
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

interface TransactionBuilderAction {
  clearTransaction: () => void
  setAccountId: (accountId: string) => void
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
  addInput: (utxo) => {
    set(
      produce((state: TransactionBuilderState) => {
        state.inputs.set(getUtxoOutpoint(utxo), utxo)
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
  broadcasted: false,
  clearTransaction: () => {
    set({
      accountId: undefined,
      broadcasted: false,
      feeRate: 0,
      inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
      outputs: [],
      psbt: undefined,
      signedPsbts: new Map<number, string>(),
      signedTx: undefined,
      txBuilderResult: undefined
    })
  },
  cpfp: true,
  fee: 0,
  feeRate: 0,
  getInputs: () => [...get().inputs.values()],
  hasInput: (utxo) => get().inputs.has(getUtxoOutpoint(utxo)),
  inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
  outputs: [],
  rbf: true,
  removeInput: (utxo) => {
    set(
      produce((state: TransactionBuilderState) => {
        state.inputs.delete(getUtxoOutpoint(utxo))
      })
    )
  },
  removeOutput: (localId) => {
    set(
      produce((state: TransactionBuilderState) => {
        const index = state.outputs.findIndex(
          (output) => output.localId === localId
        )
        if (index !== -1) {
          state.outputs.splice(index, 1)
        }
      })
    )
  },
  setAccountId: (accountId) => {
    set({ accountId })
  },
  setBroadcasted: (broadcasted) => {
    set({ broadcasted })
  },
  setFee: (fee) => {
    set({ fee })
  },
  setFeeRate: (feeRate) => {
    set({ feeRate })
  },
  setPsbt: (psbt) => {
    set({ psbt })
  },
  setRbf: (rbf) => {
    set({ rbf })
  },
  setSignedPsbts: (signedPsbts) => {
    set({ signedPsbts })
  },
  setSignedTx: (signedTx) => {
    set({ signedTx })
  },
  setTxBuilderResult: (txBuilderResult) => {
    set({ txBuilderResult })
  },
  signedPsbts: new Map<number, string>(),
  timeLock: 0,
  updateOutput: (localId, output) => {
    set(
      produce((state: TransactionBuilderState) => {
        const index = state.outputs.findIndex(
          (output) => output.localId === localId
        )
        if (index !== -1) {
          state.outputs[index] = { localId, ...output }
        }
      })
    )
  }
}))

export { useTransactionBuilderStore }
