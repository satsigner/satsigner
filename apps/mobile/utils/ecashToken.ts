import { type Token } from '@cashu/cashu-ts'

import { SAT_UNIT } from '@/constants/ecash'
import { type EcashToken } from '@/types/models/Ecash'

/**
 * Maps a token decoded by cashu-ts onto the app's token shape: every proof is
 * tagged with the token's mint, and the unit is kept only when it is sats, the
 * one unit the app models.
 */
export function toEcashToken(token: Token): EcashToken {
  return {
    memo: token.memo,
    mint: token.mint,
    proofs: token.proofs.map((proof) => ({ ...proof, mintUrl: token.mint })),
    unit: token.unit === SAT_UNIT ? SAT_UNIT : undefined
  }
}
