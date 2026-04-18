import { current, enableMapSet, produce } from 'immer'
import { type PsbtLike } from 'react-native-bdk-sdk'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { randomUuid } from '@/utils/crypto'
import { getUtxoOutpoint } from '@/utils/utxo'

enableMapSet()

type SavedDraft = {
  inputs: Record<string, Utxo>
  outputs: Output[]
  feeRate: number
  fee: number
  timeLock: number
  rbf: boolean
  cpfp: boolean
}

type TransactionBuilderState = {
  accountId?: string
  inputs: Map<ReturnType<typeof getUtxoOutpoint>, Utxo>
  outputs: Output[]
  feeRate: number
  fee: number
  timeLock: number
  rbf: boolean
  cpfp: boolean
  psbt?: PsbtLike
  signedTx?: string
  signedPsbts: Map<number, string>
  broadcasted: boolean
  drafts: Record<string, SavedDraft>
}

type TransactionBuilderAction = {
  clearPsbt: () => void
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
  setPsbt: (psbt: NonNullable<TransactionBuilderState['psbt']>) => void
  setSignedTx: (
    signedTx: NonNullable<TransactionBuilderState['signedTx']>
  ) => void
  setSignedPsbts: (signedPsbts: TransactionBuilderState['signedPsbts']) => void
  setBroadcasted: (broadcasted: boolean) => void
}

function syncDraft(state: TransactionBuilderState) {
  if (!state.accountId) {
    return
  }
  state.drafts[state.accountId] = {
    cpfp: state.cpfp,
    fee: state.fee,
    feeRate: state.feeRate,
    inputs: Object.fromEntries(current(state.inputs)),
    outputs: current(state.outputs),
    rbf: state.rbf,
    timeLock: state.timeLock
  }
}

const useTransactionBuilderStore = create<
  TransactionBuilderState & TransactionBuilderAction
>()(
  persist(
    (set, get) => ({
      accountId: undefined,
      addInput: (utxo) => {
        set(
          produce((state: TransactionBuilderState) => {
            state.inputs.set(getUtxoOutpoint(utxo), utxo)
            syncDraft(state)
          })
        )
      },
      addOutput: (output) => {
        set(
          produce((state: TransactionBuilderState) => {
            state.outputs.push({ localId: randomUuid(), ...output })
            syncDraft(state)
          })
        )
      },
      broadcasted: false,
      clearPsbt: () => {
        set({ psbt: undefined })
      },
      clearTransaction: () => {
        const { accountId, drafts } = get()
        const updatedDrafts = { ...drafts }
        if (accountId) {
          delete updatedDrafts[accountId]
        }
        set({
          accountId: undefined,
          broadcasted: false,
          cpfp: true,
          drafts: updatedDrafts,
          fee: 0,
          feeRate: 0,
          inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
          outputs: [],
          psbt: undefined,
          rbf: true,
          signedPsbts: new Map<number, string>(),
          signedTx: undefined,
          timeLock: 0
        })
      },
      cpfp: true,
      drafts: {},
      fee: 0,
      feeRate: 0,
      getInputs: () => Array.from(get().inputs.values()),
      hasInput: (utxo) => get().inputs.has(getUtxoOutpoint(utxo)),
      inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
      outputs: [],
      rbf: true,
      removeInput: (utxo) => {
        set(
          produce((state: TransactionBuilderState) => {
            state.inputs.delete(getUtxoOutpoint(utxo))
            syncDraft(state)
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
            syncDraft(state)
          })
        )
      },
      setAccountId: (accountId) => {
        const {
          accountId: currentId,
          inputs,
          outputs,
          feeRate,
          fee,
          timeLock,
          rbf,
          cpfp,
          drafts
        } = get()

        if (currentId === accountId) {
          return
        }

        const updatedDrafts = { ...drafts }

        if (currentId && (inputs.size > 0 || outputs.length > 0)) {
          updatedDrafts[currentId] = {
            cpfp,
            fee,
            feeRate,
            inputs: Object.fromEntries(inputs),
            outputs: [...outputs],
            rbf,
            timeLock
          }
        }

        const newDraft = updatedDrafts[accountId]
        set({
          accountId,
          broadcasted: false,
          cpfp: newDraft?.cpfp ?? true,
          drafts: updatedDrafts,
          fee: newDraft?.fee ?? 0,
          feeRate: newDraft?.feeRate ?? 0,
          inputs: newDraft
            ? new Map(Object.entries(newDraft.inputs))
            : new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
          outputs: newDraft?.outputs ?? [],
          psbt: undefined,
          rbf: newDraft?.rbf ?? true,
          signedPsbts: new Map<number, string>(),
          signedTx: undefined,
          timeLock: newDraft?.timeLock ?? 0
        })
      },
      setBroadcasted: (broadcasted) => {
        set({ broadcasted })
      },
      setFee: (fee) => {
        set(
          produce((state: TransactionBuilderState) => {
            state.fee = fee
            syncDraft(state)
          })
        )
      },
      setFeeRate: (feeRate) => {
        set(
          produce((state: TransactionBuilderState) => {
            state.feeRate = feeRate
            syncDraft(state)
          })
        )
      },
      setPsbt: (psbt) => {
        set({ psbt })
      },
      setRbf: (rbf) => {
        set(
          produce((state: TransactionBuilderState) => {
            state.rbf = rbf
            syncDraft(state)
          })
        )
      },
      setSignedPsbts: (signedPsbts) => {
        set({ signedPsbts })
      },
      setSignedTx: (signedTx) => {
        set({ signedTx })
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
            syncDraft(state)
          })
        )
      }
    }),
    {
      name: 'satsigner-transaction-builder',
      onRehydrateStorage: () => (state) => {
        if (!state?.accountId) {
          return
        }
        const draft = state.drafts[state.accountId]
        if (!draft) {
          return
        }
        useTransactionBuilderStore.setState({
          cpfp: draft.cpfp,
          fee: draft.fee,
          feeRate: draft.feeRate,
          inputs: new Map(Object.entries(draft.inputs)),
          outputs: draft.outputs,
          rbf: draft.rbf,
          timeLock: draft.timeLock
        })
      },
      partialize: (state) => ({
        accountId: state.accountId,
        drafts: state.drafts
      }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useTransactionBuilderStore }
export type { SavedDraft }
