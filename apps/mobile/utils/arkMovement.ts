import type { ArkMovement, ArkMovementKind } from '@/types/models/Ark'

const REFRESH_SUBSYSTEM_KEYWORD = 'refresh'

const LIGHTNING_SUBSYSTEM_KINDS = new Set([
  'invoice',
  'offer',
  'lightning_address'
])

function isFeeOnlyMovement(movement: ArkMovement): boolean {
  return (
    movement.offchainFeeSats > 0 &&
    movement.effectiveBalanceSats + movement.offchainFeeSats === 0
  )
}

export function getArkMovementKind(movement: ArkMovement): ArkMovementKind {
  if (
    movement.subsystemName.toLowerCase().includes(REFRESH_SUBSYSTEM_KEYWORD)
  ) {
    return 'refresh'
  }
  if (movement.effectiveBalanceSats > 0) {
    return 'receive'
  }
  if (isFeeOnlyMovement(movement)) {
    return 'refresh'
  }
  if (movement.effectiveBalanceSats < 0) {
    return 'send'
  }
  return 'refresh'
}

export function isLightningMovement(movement: ArkMovement): boolean {
  return LIGHTNING_SUBSYSTEM_KINDS.has(movement.subsystemKind.toLowerCase())
}

export function getArkMovementAmountSats(movement: ArkMovement): number {
  return Math.abs(movement.effectiveBalanceSats)
}
