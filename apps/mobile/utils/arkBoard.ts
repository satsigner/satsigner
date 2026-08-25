import { DUST_LIMIT } from '@/constants/btc'

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

export type ArkAutoBoardStatus =
  | 'loading'
  | 'waitingForFunds'
  | 'waitingConfirmation'
  | 'belowMinimum'
  | 'readyToBoard'
  | 'boarding'
  | 'failed'

type ArkAutoBoardState = {
  confirmedSats: number
  pendingSats: number
  minBoardAmountSats: number | undefined
  isBoarding: boolean
  boardFailed: boolean
}

export function getArkMinBoardAmount(
  minBoardAmountSats: number | undefined
): number | undefined {
  if (minBoardAmountSats === undefined) {
    return undefined
  }
  return Math.max(DUST_LIMIT, minBoardAmountSats)
}

export function getArkAutoBoardStatus({
  confirmedSats,
  pendingSats,
  minBoardAmountSats,
  isBoarding,
  boardFailed
}: ArkAutoBoardState): ArkAutoBoardStatus {
  if (boardFailed) {
    return 'failed'
  }
  if (isBoarding) {
    return 'boarding'
  }
  const minAmountSats = getArkMinBoardAmount(minBoardAmountSats)
  if (minAmountSats === undefined) {
    return 'loading'
  }
  if (confirmedSats >= minAmountSats) {
    return 'readyToBoard'
  }
  if (pendingSats > 0) {
    return 'waitingConfirmation'
  }
  if (confirmedSats > 0) {
    return 'belowMinimum'
  }
  return 'waitingForFunds'
}
