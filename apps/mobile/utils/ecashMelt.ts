import { MeltQuoteState } from '@cashu/cashu-ts'

import type { EcashMeltResult, EcashProof } from '@/types/models/Ecash'
import { assertNever } from '@/utils/assertNever'
import { proofsAfterMelt } from '@/utils/ecashProofs'

type EcashMeltStatus = EcashMeltResult['status']

/**
 * The mint answers a melt with the quote state instead of throwing, so only
 * `PAID` means the Lightning payment went through.
 */
function toEcashMeltStatus(state: MeltQuoteState): EcashMeltStatus {
  switch (state) {
    case MeltQuoteState.PAID: {
      return 'paid'
    }
    case MeltQuoteState.PENDING: {
      return 'pending'
    }
    case MeltQuoteState.UNPAID: {
      return 'unpaid'
    }
    default: {
      return assertNever(state)
    }
  }
}

/**
 * The account's proofs after a melt. An unpaid melt releases `send` at the
 * mint. A pending one keeps it reserved, and proof validation skips it until
 * the payment settles or fails.
 */
function proofsAfterMeltResult(
  allProofs: EcashProof[],
  meltedProofs: EcashProof[],
  result: EcashMeltResult
): EcashProof[] {
  const returned = result.status === 'paid' ? result.change : result.send
  return proofsAfterMelt(allProofs, meltedProofs, result.keep, returned)
}

export { proofsAfterMeltResult, toEcashMeltStatus }
