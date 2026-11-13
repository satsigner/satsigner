import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { isChangeOutputLabel } from '@/utils/address'

const DEFAULT_AUTO_SELECT: AutoSelectUtxosAlgorithm = 'user'

type DraftAlgorithmSource = {
  outputs?: Pick<Output, 'kind'>[]
  selectedAutoSelectUtxos?: AutoSelectUtxosAlgorithm
}

type DraftIoSource = {
  fee?: number
  inputs?: Record<string, Pick<Utxo, 'value'>>
  outputs?: Pick<Output, 'amount' | 'kind'>[]
  selectedAutoSelectUtxos?: AutoSelectUtxosAlgorithm
  stonewallPreview?: {
    changeValues?: number[]
    fakeMixValues?: number[]
  }
}

type DraftPaymentSource = {
  outputs?: Pick<Output, 'amount' | 'kind' | 'label'>[]
}

type DraftLabelSource = {
  outputs?: Pick<Output, 'kind' | 'label'>[]
}

type DraftResumeSource = {
  prebuiltPsbtBase64?: string
  signedTx?: string
}

/**
 * Resolve the UTXO selection algorithm for a saved draft.
 * Legacy drafts without `selectedAutoSelectUtxos` infer privacy from stonewall outputs.
 */
function resolveDraftAlgorithm(
  draft?: DraftAlgorithmSource
): AutoSelectUtxosAlgorithm {
  if (draft?.selectedAutoSelectUtxos) {
    return draft.selectedAutoSelectUtxos
  }
  if (
    draft?.outputs?.some(
      (output) => output.kind === 'fakeMix' || output.kind === 'change'
    )
  ) {
    return 'privacy'
  }
  return DEFAULT_AUTO_SELECT
}

/** Draft card I/O counts, including stonewall preview and impending change. */
function getDraftIoCounts(draft?: DraftIoSource): {
  inputCount: number
  outputCount: number
} {
  if (!draft) {
    return { inputCount: 0, outputCount: 0 }
  }

  const inputs = draft.inputs ?? {}
  const outputs = draft.outputs ?? []
  const inputCount = Object.keys(inputs).length
  const algorithm = resolveDraftAlgorithm(draft)
  const hasMaterializedStonewall = outputs.some(
    (output) => output.kind === 'fakeMix' || output.kind === 'change'
  )

  if (algorithm === 'privacy' && !hasMaterializedStonewall) {
    const previewExtra =
      (draft.stonewallPreview?.changeValues?.length ?? 0) +
      (draft.stonewallPreview?.fakeMixValues?.length ?? 0)
    if (previewExtra > 0) {
      return {
        inputCount,
        outputCount: outputs.length + previewExtra
      }
    }
  }

  if (hasMaterializedStonewall) {
    return { inputCount, outputCount: outputs.length }
  }

  const inputTotal = Object.values(inputs).reduce(
    (sum, utxo) => sum + utxo.value,
    0
  )
  const outputTotal = outputs.reduce((sum, output) => sum + output.amount, 0)
  const remaining = inputTotal - outputTotal - (draft.fee ?? 0)
  if (remaining > 0) {
    return { inputCount, outputCount: outputs.length + 1 }
  }

  return { inputCount, outputCount: outputs.length }
}

/** First label set on a recipient output; change and stonewall outputs are skipped. */
function getDraftLabel(draft?: DraftLabelSource): string {
  const labeled = draft?.outputs?.find(
    (output) => !isReturnToWalletOutput(output) && output.label.trim() !== ''
  )
  return labeled?.label.trim() ?? ''
}

type DraftResumeStep = 'sign' | 'preview' | 'io'

/**
 * Where an unfinished draft picks up. A fee replacement's inputs are already
 * spent, so it can only resume from the PSBT the replacement built.
 */
function getDraftResumeStep(draft?: DraftResumeSource): DraftResumeStep {
  if (draft?.signedTx) {
    return 'sign'
  }
  if (draft?.prebuiltPsbtBase64) {
    return 'preview'
  }
  return 'io'
}

function isReturnToWalletOutput(output: Pick<Output, 'kind' | 'label'>) {
  return (
    output.kind === 'change' ||
    output.kind === 'fakeMix' ||
    isChangeOutputLabel(output.label)
  )
}

/**
 * Amount the draft pays out. Change, including the change output added on the
 * way to signing, goes back to the wallet, as the sign screen's chart shows.
 */
function getDraftPaymentAmount(draft?: DraftPaymentSource): number {
  const outputs = draft?.outputs ?? []
  return outputs
    .filter((output) => !isReturnToWalletOutput(output))
    .reduce((sum, output) => sum + output.amount, 0)
}

export {
  DEFAULT_AUTO_SELECT,
  getDraftIoCounts,
  getDraftLabel,
  getDraftPaymentAmount,
  getDraftResumeStep,
  resolveDraftAlgorithm
}
export type { DraftResumeStep }
