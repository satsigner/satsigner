import { EcashMeltFailedError, EcashSpentProofsError } from '@/api/ecash'
import type { EcashProof } from '@/types/models/Ecash'
import { proofsAfterMelt, removeSpentSecrets } from '@/utils/ecashProofs'

/**
 * The account's proofs after a melt threw `error`, or null when the error
 * leaves the stored proofs as they are.
 */
function proofsAfterFailedMelt(
  error: unknown,
  currentProofs: EcashProof[],
  meltedProofs: EcashProof[]
): EcashProof[] | null {
  if (error instanceof EcashSpentProofsError) {
    return removeSpentSecrets(currentProofs, error.spentProofSecrets)
  }
  if (error instanceof EcashMeltFailedError) {
    return proofsAfterMelt(currentProofs, meltedProofs, error.keep, error.send)
  }
  return null
}

export { proofsAfterFailedMelt }
