import { getTokenMetadata } from '@cashu/cashu-ts'

import {
  type EcashToken,
  type EcashTokenValidation,
  type EcashTransaction
} from '@/types/models/Ecash'

/**
 * Reads a token without its mint's keysets, so it works for any mint. Full
 * proofs need them: cashu-ts writes short keyset ids, and v2 ones only map
 * back to full ids against the mint's keysets.
 */
export function readEcashToken(token: string): EcashToken | null {
  try {
    const { amount, incompleteProofs, memo, mint } = getTokenMetadata(token)
    return {
      amount,
      memo,
      mint,
      proofAmounts: incompleteProofs.map((proof) => proof.amount)
    }
  } catch {
    return null
  }
}

/**
 * A token check reports a fully spent token as valid, so the spent flag has
 * to decide between spent and unspent; only an unreadable token is invalid.
 */
export function toCheckedTokenStatus(
  validation: EcashTokenValidation
): EcashTransaction['tokenStatus'] {
  if (!validation.isValid) {
    return 'invalid'
  }
  return validation.isSpent ? 'spent' : 'unspent'
}
