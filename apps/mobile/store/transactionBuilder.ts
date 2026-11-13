import { current, type Draft, enableMapSet } from 'immer'
import { Psbt, type PsbtLike } from 'react-native-bdk-sdk'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import mmkvStorage from '@/storage/mmkv'
import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import {
  type FeeReplacementDraft,
  type PrebuiltReplacement
} from '@/types/models/FeeReplacement'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { randomUuid } from '@/utils/crypto'
import {
  DEFAULT_AUTO_SELECT,
  resolveDraftAlgorithm
} from '@/utils/draftSelection'
import { isRecord } from '@/utils/object'
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
  /** Txid this draft replaces (RBF bump or cancel). */
  replacesTxid?: string
  /** Full BIP21 URI with pj= when the draft pays a Payjoin invoice. */
  payjoinUri?: string
  /** Unsigned PSBT a fee replacement built, kept until the builder is edited. */
  prebuiltPsbtBase64?: string
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
  /** Built outside the preview (fee replacement), so the preview must not rebuild it from inputs. */
  isPsbtPrebuilt: boolean
  /** Builder fields the prebuilt PSBT was made from; see builderFingerprint. */
  prebuiltFingerprint?: string
  /** Txid this draft replaces (RBF bump or cancel). */
  replacesTxid?: string
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
  clearAllData: () => void
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
  replaceDraft: (
    accountId: string,
    draft: FeeReplacementDraft,
    replacement?: PrebuiltReplacement
  ) => void
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
    labelOverrides: { ...preview.labelOverrides }
  }
}

function restorePrebuiltPsbt(base64?: string): PsbtLike | undefined {
  if (!base64) {
    return undefined
  }
  try {
    return new Psbt(base64)
  } catch {
    return undefined
  }
}

// The builder fields an account's saved draft resumes into, or a blank
// builder when the account has no draft.
function workingStateFromDraft(draft: SavedDraft | undefined) {
  const prebuiltPsbt = restorePrebuiltPsbt(draft?.prebuiltPsbtBase64)
  const fields = {
    fee: draft?.fee ?? 0,
    feeRate: draft?.feeRate ?? 0,
    inputs: draft
      ? new Map(Object.entries(draft.inputs))
      : new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
    outputs: draft?.outputs ?? [],
    rbf: draft?.rbf ?? true,
    timeLock: draft?.timeLock ?? 0
  }
  return {
    ...fields,
    cpfp: draft?.cpfp ?? true,
    isPsbtPrebuilt: prebuiltPsbt !== undefined,
    payjoinUri: draft?.payjoinUri,
    prebuiltFingerprint: prebuiltPsbt ? builderFingerprint(fields) : undefined,
    psbt: prebuiltPsbt,
    replacesTxid: draft?.replacesTxid,
    selectedAutoSelectUtxos: resolveDraftAlgorithm(draft),
    signedPsbtBase64: draft?.signedPsbtBase64,
    signedTx: draft?.signedTx,
    stonewallPreview: normalizeStonewallPreview(draft?.stonewallPreview)
  }
}

function clearSignedDraftFields(state: Draft<TransactionBuilderState>) {
  state.signedPsbtBase64 = undefined
  state.signedTx = undefined
}

type DraftSource = Pick<
  TransactionBuilderState,
  | 'cpfp'
  | 'fee'
  | 'feeRate'
  | 'inputs'
  | 'isPsbtPrebuilt'
  | 'outputs'
  | 'payjoinUri'
  | 'prebuiltFingerprint'
  | 'psbt'
  | 'rbf'
  | 'replacesTxid'
  | 'selectedAutoSelectUtxos'
  | 'signedPsbtBase64'
  | 'signedTx'
  | 'stonewallPreview'
  | 'timeLock'
>

type FingerprintSource = Pick<
  TransactionBuilderState,
  'fee' | 'feeRate' | 'inputs' | 'outputs' | 'rbf' | 'timeLock'
>

// The fields a PSBT commits to. A prebuilt PSBT is only saved while the
// builder still matches it: an edit made before the app stops must not come
// back as a PSBT that ignores it.
function builderFingerprint(source: FingerprintSource): string {
  return JSON.stringify({
    fee: source.fee,
    feeRate: source.feeRate,
    inputs: [...source.inputs.keys()].toSorted(),
    outputs: source.outputs.map((output) => [output.to, output.amount]),
    rbf: source.rbf,
    timeLock: source.timeLock
  })
}

function savedPrebuiltPsbt(source: DraftSource): string | undefined {
  if (
    !source.isPsbtPrebuilt ||
    source.prebuiltFingerprint !== builderFingerprint(source)
  ) {
    return undefined
  }
  return source.psbt?.toBase64()
}

function toSavedDraft(source: DraftSource): SavedDraft {
  const preview = source.stonewallPreview
  return {
    cpfp: source.cpfp,
    fee: source.fee,
    feeRate: source.feeRate,
    inputs: Object.fromEntries(source.inputs),
    outputs: [...source.outputs],
    payjoinUri: source.payjoinUri,
    prebuiltPsbtBase64: savedPrebuiltPsbt(source),
    rbf: source.rbf,
    replacesTxid: source.replacesTxid,
    selectedAutoSelectUtxos: source.selectedAutoSelectUtxos,
    signedPsbtBase64: source.signedPsbtBase64,
    signedTx: source.signedTx,
    stonewallPreview: {
      changeValues: [...preview.changeValues],
      excludedUtxoOutpoints: [...preview.excludedUtxoOutpoints],
      fakeMixValues: [...preview.fakeMixValues],
      fee: preview.fee,
      labelOverrides: { ...preview.labelOverrides }
    },
    timeLock: source.timeLock
  }
}

// A broadcast transaction is finished: saving it again would bring back a
// "ready to broadcast" draft for something already on the network.
function syncDraft(state: Draft<TransactionBuilderState>) {
  if (!state.accountId || state.broadcasted) {
    return
  }
  // Avoid current(stonewallPreview): after replace it may be a plain object.
  state.drafts[state.accountId] = toSavedDraft({
    ...state,
    inputs: current(state.inputs),
    outputs: current(state.outputs)
  })
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
      clearAllData: () => {
        set({
          ...workingStateFromDraft(undefined),
          accountId: undefined,
          broadcasted: false,
          drafts: {},
          signedPsbts: new Map<number, string>()
        })
      },
      clearPsbt: () => {
        set((state) => {
          state.isPsbtPrebuilt = false
          state.psbt = undefined
          syncDraft(state)
        })
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
          ...workingStateFromDraft(undefined),
          accountId: undefined,
          broadcasted: false,
          drafts: updatedDrafts,
          signedPsbts: new Map<number, string>()
        })
      },
      cpfp: true,
      drafts: {},
      fee: 0,
      feeRate: 0,
      getInputs: () => [...get().inputs.values()],
      hasInput: (utxo) => get().inputs.has(getUtxoOutpoint(utxo)),
      inputs: new Map<ReturnType<typeof getUtxoOutpoint>, Utxo>(),
      isPsbtPrebuilt: false,
      outputs: [],
      payjoinUri: undefined,
      rbf: true,
      removeInput: (utxo) => {
        const { inputs, replacesTxid } = get()
        if (replacesTxid && inputs.has(getUtxoOutpoint(utxo))) {
          get().clearTransaction()
          return
        }
        set((state) => {
          clearSignedDraftFields(state)
          state.inputs.delete(getUtxoOutpoint(utxo))
          syncDraft(state)
        })
      },
      removeOrphanedInputs: (accountUtxos) => {
        const validOutpoints = new Set(accountUtxos.map(getUtxoOutpoint))
        const { inputs, replacesTxid } = get()
        if (
          replacesTxid &&
          [...inputs.keys()].some((outpoint) => !validOutpoints.has(outpoint))
        ) {
          get().clearTransaction()
          return
        }
        set((state) => {
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
      replaceDraft: (accountId, draft, replacement) => {
        set((state) => {
          state.accountId = accountId
          state.broadcasted = false
          state.fee = draft.fee
          state.feeRate = draft.feeRate
          state.inputs.clear()
          for (const utxo of draft.inputs) {
            state.inputs.set(getUtxoOutpoint(utxo), utxo)
          }
          // Mutate in place: syncDraft calls current(), which needs a draft.
          state.outputs.splice(
            0,
            state.outputs.length,
            ...draft.outputs.map((output) => ({
              ...output,
              localId: randomUuid()
            }))
          )
          state.payjoinUri = undefined
          state.rbf = true
          state.replacesTxid = replacement?.replacesTxid
          state.selectedAutoSelectUtxos = 'user'
          state.signedPsbtBase64 = undefined
          state.signedPsbts = new Map<number, string>()
          state.signedTx = undefined
          state.stonewallPreview = normalizeStonewallPreview()
          state.timeLock = 0
          state.isPsbtPrebuilt = replacement !== undefined
          state.psbt = replacement?.psbt
          state.prebuiltFingerprint = replacement
            ? builderFingerprint(state)
            : undefined
          syncDraft(state)
        })
      },
      selectedAutoSelectUtxos: DEFAULT_AUTO_SELECT,
      setAccountId: (accountId) => {
        const builder = get()
        if (builder.accountId === accountId) {
          return
        }

        const updatedDrafts = { ...builder.drafts }
        const isUnfinished =
          !builder.broadcasted &&
          (builder.inputs.size > 0 ||
            builder.outputs.length > 0 ||
            Boolean(builder.signedTx))
        if (builder.accountId && isUnfinished) {
          updatedDrafts[builder.accountId] = toSavedDraft(builder)
        }

        set({
          ...workingStateFromDraft(updatedDrafts[accountId]),
          accountId,
          broadcasted: false,
          drafts: updatedDrafts,
          signedPsbts: new Map<number, string>()
        })
      },
      // A broadcast transaction is done: its draft must not come back as
      // "ready to broadcast" after a restart or an account switch.
      setBroadcasted: (broadcasted) => {
        set((state) => {
          state.broadcasted = broadcasted
          if (broadcasted && state.accountId) {
            delete state.drafts[state.accountId]
          }
        })
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
        set((state) => {
          state.payjoinUri = payjoinUri
          syncDraft(state)
        })
      },
      setPsbt: (psbt) => {
        set({ psbt })
      },
      setRbf: (rbf) => {
        set((state) => {
          if (state.rbf !== rbf) {
            clearSignedDraftFields(state)
          }
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
      // MMKV hydrates while the store is still being created, so the open
      // draft is rebuilt here: the store itself is not reachable yet.
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(isRecord(persistedState) ? persistedState : {})
        }
        const draft = merged.accountId
          ? merged.drafts[merged.accountId]
          : undefined
        return draft ? { ...merged, ...workingStateFromDraft(draft) } : merged
      },
      name: 'satsigner-transaction-builder',
      partialize: (state) => ({
        accountId: state.accountId,
        drafts: state.drafts
      }),
      storage: createJSONStorage(() => mmkvStorage),
      version: 0
    }
  )
)

function hasUnfinishedDraft(
  state: Pick<TransactionBuilderState, 'drafts'>,
  accountId: string
): boolean {
  const draft = state.drafts[accountId]
  if (!draft) {
    return false
  }
  return (
    Object.keys(draft.inputs).length > 0 ||
    draft.outputs.length > 0 ||
    draft.signedTx !== undefined
  )
}

export { hasUnfinishedDraft, useTransactionBuilderStore }
