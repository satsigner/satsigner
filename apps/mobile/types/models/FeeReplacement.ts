import { type PolicyType } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'

export type FeeReplacementAssessment = {
  allInputsOwned: boolean
  canBumpOrCancel: boolean
  canCpfp: boolean
  hasUnspentOwnedOutput: boolean
  signalsRbf: boolean
  unconfirmed: boolean
}

export type FeeReplacementActions = {
  bump: boolean
  cancel: boolean
  cpfp: boolean
}

export type PreviewReplacementFlags = {
  showCpfp: boolean
  showRbf: boolean
}

export type FeeReplacementOutput = Omit<Output, 'localId'>

export type FeeReplacementDraft = {
  fee: number
  feeRate: number
  inputs: Utxo[]
  outputs: FeeReplacementOutput[]
  rbf: true
}

export type FeeReplacementDraftResult =
  | { draft: FeeReplacementDraft; ok: true }
  | {
      ok: false
      reason: 'insufficient' | 'no-destination' | 'unresolved-inputs'
    }

export type FeeReplacementPolicy = PolicyType
