export type ArkBoardValidationReason =
  | 'invalidAmount'
  | 'belowMinimum'
  | 'insufficientFunds'

export type ArkBoardValidation =
  | { valid: true }
  | { valid: false; reason: ArkBoardValidationReason }

type ValidateBoardAmountArgs = {
  amountSats: number
  availableSats: number
  minBoardAmountSats?: number
}

export function validateBoardAmount({
  amountSats,
  availableSats,
  minBoardAmountSats
}: ValidateBoardAmountArgs): ArkBoardValidation {
  if (!Number.isInteger(amountSats) || amountSats <= 0) {
    return { reason: 'invalidAmount', valid: false }
  }
  if (minBoardAmountSats !== undefined && amountSats < minBoardAmountSats) {
    return { reason: 'belowMinimum', valid: false }
  }
  if (amountSats > availableSats) {
    return { reason: 'insufficientFunds', valid: false }
  }
  return { valid: true }
}
