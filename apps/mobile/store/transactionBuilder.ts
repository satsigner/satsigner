import { current, type Draft, enableMapSet } from 'immer'
import { type PsbtLike } from 'react-native-bdk-sdk'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import mmkvStorage from '@/storage/mmkv'
import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { randomUuid } from '@/utils/crypto'
import {
  DEFAULT_AUTO_SELECT,
  resolveDraftAlgorithm
} from '@/utils/draftSelection'
import { getUtxoOutpoint } from '@/utils/utxo'

enableMapSet()

type StonewallPreviewState = {
  changeValues: number[]
  excludedUtxoOutpoints: string[]
  fakeMixValues: number[]
  fee: number | null
  labelOverrides: Record<string, string>
}

const EMPTY_STONEWALL_PREVIEW: StonewallPreviewState = {
  changeValues: [],
  excludedUtxoOutpoints: [],
  fakeMixValues: [],
  fee: null,
  labelOverrides: {}
}

type SavedDraft = {
  inputs: Record<string, Utxo>
  outputs: Output[]
  feeRate: number
  fee: number
  timeLock: number
  rbf: boolean
  cpfp: boolean
  /** Last applied UTXO selection mode — defaults to 'user' for older drafts. */
  selectedAutoSelectUtxos?: AutoSelectUtxosAlgorithm
  stonewallPreview?: StonewallPreviewState
  /** Broadcast-ready raw tx hex (survives process death). */
  signedTx?: string
  /** Finalized PSBT base64 for restoring UI/chart after restart. */
  signedPsbtBase64?: string
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
  selectedAutoSelectUtxos: AutoSelectUtxosAlgorithm
  stonewallPreview: StonewallPreviewState
  /** Full BIP21 URI with pj= when sending to a Payjoin invoice. */
  payjoinUri?: string
  psbt?: PsbtLike
  signedTx?: string
  /** Finalized PSBT base64 paired with signedTx (draft persistence). */
  signedPsbtBase64?: string
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
  removeOrphanedInputs: (accountUtxos: Utxo[]) => void
  addOutput: (output: Omit<Output, 'localId'>) => void
  updateOutput: (
    localId: Output['localId'],
    output: Omit<Output, 'localId'>
  ) => void
  removeOutput: (localId: Output['localId']) => void
  setFeeRate: (feeRate: TransactionBuilderState['feeRate']) => void
  setFee: (fee: TransactionBuilderState['fee']) => void
  setRbf: (rbf: TransactionBuilderState['rbf']) => void
  setSelectedAutoSelectUtxos: (algorithm: AutoSelectUtxosAlgorithm) => void
  setStonewallPreview: (preview: Partial<StonewallPreviewState>) => void
  clearStonewallPreview: () => void
  setPsbt: (psbt: NonNullable<TransactionBuilderState['psbt']>) => void
  setSignedTx: (
    signedTx: NonNullable<TransactionBuilderState['signedTx']>,
    signedPsbtBase64?: string
  ) => void
  setSignedPsbts: (signedPsbts: TransactionBuilderState['signedPsbts']) => void
  setBroadcasted: (broadcasted: boolean) => void
  setPayjoinUri: (payjoinUri: string | undefined) => void
}

function normalizeStonewallPreview(
  preview?: StonewallPreviewState
): StonewallPreviewState {
  if (!preview) {
    return { ...EMPTY_STONEWALL_PREVIEW, labelOverrides: {} }
  }
  return {
    changeValues: preview.changeValues ?? [],
    excludedUtxoOutpoints: preview.excludedUtxoOutpoints ?? [],
    fakeMixValues: preview.fakeMixValues ?? [],
    fee: preview.fee ?? null,
    labelOverrides: { ...(preview.labelOverrides ?? {}) }
  }
}

function clearSignedDraftFields(state: Draft<TransactionBuilderState>) {
  state.signedPsbtBase64 = undefined
  state.signedTx = undefined
}

function syncDraft(state: Draft<TransactionBuilderState>) {
  if (!state.accountId) {
    return
  }
  // Avoid current(stonewallPreview): after replace it may be a plain object.
  const preview = state.stonewallPreview
  state.drafts[state.accountId] = {
    cpfp: state.cpfp,
    fee: state.fee,
    feeRate: state.feeRate,
    inputs: Object.fromEntries(current(state.inputs)),
    outputs: current(state.outputs),
    rbf: state.rbf,
    selectedAutoSelectUtxos: state.selectedAutoSelectUtxos,
    signedPsbtBase64: state.signedPsbtBase64,
    signedTx: state.signedTx,
    stonewallPreview: {
      changeValues: [...preview.changeValues],
      excludedUtxoOutpoints: [...preview.excludedUtxoOutpoints],
      fakeMixValues: [...preview.fakeMixValues],
      fee: preview.fee,
      labelOverrides: { ...preview.labelOverrides }
    },
    timeLock: state.timeLock
  }
}

const useTransactionBuilderStore = create<
  TransactionBuilderState & TransactionBuilderAction
>()(
  persist(
    immer((set, get) => ({
      accountId: undefined,
      addInput: (utxo) => {
        set((state) => {
          clearSignedDraftFields(state)
          state.inputs.set(getUtxoOutpoint(utxo), utxo)
          syncDraft(state)
        })
      },
      addOutput: (output) => {
        set((state) => {
          clearSignedDraftFields(state)
          state.outputs.push({ localId: randomUuid(), ...output })
          syncDraft(state)
        })
      },
      broadcasted: false,
      clearPsbt: () => {
        set({ psbt: undefined })
      },
      clearStonewallPreview: () => {
        set((state) => {
          state.stonewallPreview = normalizeStonewallPreview()
          syncDraft(state)
        })
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
          payjoinUri: undefined,
          psbt: undefined,
          rbf: true,
          selectedAutoSelectUtxos: DEFAULT_AUTO_SELECT,
          signedPsbtBase64: undefined,
          signedPsbts: new Map<number, string>(),
          signedTx: undefined,
          stonewallPreview: normalizeStonewallPreview(),
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
      payjoinUri: undefined,
      rbf: true,
      removeInput: (utxo) => {
        set((state) => {
          clearSignedDraftFields(state)
          state.inputs.delete(getUtxoOutpoint(utxo))
          syncDraft(state)
        })
      },
      removeOrphanedInputs: (accountUtxos) => {
        set((state) => {
          const validOutpoints = new Set(accountUtxos.map(getUtxoOutpoint))
          let removed = false
          for (const outpoint of state.inputs.keys()) {
            if (!validOutpoints.has(outpoint)) {
              state.inputs.delete(outpoint)
              removed = true
            }
          }
          if (removed) {
            clearSignedDraftFields(state)
          }
          syncDraft(state)
        })
      },
      removeOutput: (localId) => {
        set((state) => {
          const index = state.outputs.findIndex(
            (output) => output.localId === localId
          )
          if (index !== -1) {
            clearSignedDraftFields(state)
            state.outputs.splice(index, 1)
          }
          syncDraft(state)
        })
      },
      selectedAutoSelectUtxos: DEFAULT_AUTO_SELECT,
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
          drafts,
          selectedAutoSelectUtxos,
          signedPsbtBase64,
          signedTx,
          stonewallPreview
        } = get()

        if (currentId === accountId) {
          return
        }

        const updatedDrafts = { ...drafts }

        if (currentId && (inputs.size > 0 || outputs.length > 0 || signedTx)) {
          updatedDrafts[currentId] = {
            cpfp,
            fee,
            feeRate,
            inputs: Object.fromEntries(inputs),
            outputs: [...outputs],
            rbf,
            selectedAutoSelectUtxos,
            signedPsbtBase64,
            signedTx,
            stonewallPreview: normalizeStonewallPreview(stonewallPreview),
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
          selectedAutoSelectUtxos: resolveDraftAlgorithm(newDraft),
          signedPsbtBase64: newDraft?.signedPsbtBase64,
          signedPsbts: new Map<number, string>(),
          signedTx: newDraft?.signedTx,
          stonewallPreview: normalizeStonewallPreview(
            newDraft?.stonewallPreview
          ),
          timeLock: newDraft?.timeLock ?? 0
        })
      },
      setBroadcasted: (broadcasted) => {
        set({ broadcasted })
      },
      setFee: (fee) => {
        set((state) => {
          if (state.fee !== fee) {
            clearSignedDraftFields(state)
          }
          state.fee = fee
          syncDraft(state)
        })
      },
      setFeeRate: (feeRate) => {
        set((state) => {
          if (state.feeRate !== feeRate) {
            clearSignedDraftFields(state)
          }
          state.feeRate = feeRate
          syncDraft(state)
        })
      },
      setPayjoinUri: (payjoinUri) => {
        set({ payjoinUri })
      },
      setPsbt: (psbt) => {
        set({ psbt })
      },
      setRbf: (rbf) => {
        set((state) => {
          state.rbf = rbf
          syncDraft(state)
        })
      },
      setSelectedAutoSelectUtxos: (algorithm) => {
        set((state) => {
          state.selectedAutoSelectUtxos = algorithm
          syncDraft(state)
        })
      },
      setSignedPsbts: (signedPsbts) => {
        set({ signedPsbts })
      },
      setSignedTx: (signedTx, signedPsbtBase64) => {
        set((state) => {
          state.signedTx = signedTx || undefined
          if (signedPsbtBase64 !== undefined) {
            state.signedPsbtBase64 = signedPsbtBase64 || undefined
          } else if (!signedTx) {
            state.signedPsbtBase64 = undefined
          }
          syncDraft(state)
        })
      },
      setStonewallPreview: (preview) => {
        set((state) => {
          state.stonewallPreview = {
            ...state.stonewallPreview,
            ...preview,
            labelOverrides:
              preview.labelOverrides !== undefined
                ? preview.labelOverrides
                : state.stonewallPreview.labelOverrides
          }
          syncDraft(state)
        })
      },
      signedPsbtBase64: undefined,
      signedPsbts: new Map<number, string>(),
      stonewallPreview: normalizeStonewallPreview(),
      timeLock: 0,
      updateOutput: (localId, output) => {
        set((state) => {
          const index = state.outputs.findIndex(
            (entry) => entry.localId === localId
          )
          if (index !== -1) {
            clearSignedDraftFields(state)
            state.outputs[index] = { localId, ...output }
          }
          syncDraft(state)
        })
      }
    })),
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
          selectedAutoSelectUtxos: resolveDraftAlgorithm(draft),
          signedPsbtBase64: draft.signedPsbtBase64,
          signedTx: draft.signedTx,
          stonewallPreview: normalizeStonewallPreview(draft.stonewallPreview),
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
export type { SavedDraft, StonewallPreviewState }
