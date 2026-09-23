import { PRIVACY_MASK } from '@/constants/privacy'
import type { EcashProof } from '@/types/models/Ecash'
import { formatNumber } from '@/utils/format'
import type { PackedBubbleDatum } from '@/utils/packedBubbleLayout'

export function ecashProofsToBubbleData(
  proofs: EcashProof[],
  privacyMode: boolean
): PackedBubbleDatum[] {
  return proofs.map((proof, index) => ({
    id: `${proof.id}-${index}`,
    label: privacyMode ? PRIVACY_MASK : formatNumber(Math.round(proof.amount)),
    value: proof.amount
  }))
}

export function proofsAfterSend(
  allProofs: EcashProof[],
  consumedProofs: EcashProof[],
  keep: EcashProof[]
): EcashProof[] {
  return replaceConsumedProofs(allProofs, consumedProofs, keep)
}

export function proofsAfterMelt(
  allProofs: EcashProof[],
  consumedProofs: EcashProof[],
  keep: EcashProof[],
  change: EcashProof[]
): EcashProof[] {
  return replaceConsumedProofs(allProofs, consumedProofs, [...keep, ...change])
}

function replaceConsumedProofs(
  allProofs: EcashProof[],
  consumedProofs: EcashProof[],
  nextProofs: EcashProof[]
): EcashProof[] {
  const consumed = new Set(consumedProofs.map((proof) => proof.secret))
  return [
    ...allProofs.filter((proof) => !consumed.has(proof.secret)),
    ...nextProofs
  ]
}

export function removeSpentSecrets(
  allProofs: EcashProof[],
  spentSecrets: string[]
): EcashProof[] {
  const spent = new Set(spentSecrets)
  return allProofs.filter((proof) => !spent.has(proof.secret))
}
