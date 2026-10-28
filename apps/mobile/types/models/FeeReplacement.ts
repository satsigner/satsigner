import { type PsbtLike } from 'react-native-bdk-sdk'

import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'

export type FeeReplacementKind = 'bump' | 'cancel' | 'cpfp'

export type FeeReplacementAssessment = {
  canBumpOrCancel: boolean
  canCpfp: boolean
  signalsRbf: boolean
  unconfirmed: boolean
}

export type FeeReplacementActions = Record<FeeReplacementKind, boolean>

export type FeeReplacementOutput = Omit<Output, 'localId'>

export type FeeReplacementDraft = {
  fee: number
  feeRate: number
  inputs: Utxo[]
  outputs: FeeReplacementOutput[]
}

export type FeeReplacementRecipient = {
  address: string
  amountSats: number
}

export type FeeReplacementDraftResult =
  | { draft: FeeReplacementDraft; ok: true }
  | { ok: false; reason: 'insufficient' | 'no-destination' }

export type PrebuiltReplacement = {
  psbt: PsbtLike
  replacesTxid: string
}
