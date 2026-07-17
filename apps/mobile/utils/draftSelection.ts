import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'

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

export { DEFAULT_AUTO_SELECT, getDraftIoCounts, resolveDraftAlgorithm }
