import type { ArkMovement, ArkMovementKind } from '@/types/models/Ark'

const REFRESH_SUBSYSTEM_KEYWORD = 'refresh'

const LIGHTNING_SUBSYSTEM_KINDS = new Set([
  'invoice',
  'offer',
  'lightning_address'
])

const COUNTERPARTY_TRUNCATE_CHARS = 8

const STALE_EXIT_SUBSYSTEM_NAME = 'bark.exit'
const STALE_EXIT_SUBSYSTEM_KIND = 'start'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

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

export function isStaleArkExitMovement(movement: ArkMovement): boolean {
  return (
    movement.subsystemName === STALE_EXIT_SUBSYSTEM_NAME &&
    movement.subsystemKind === STALE_EXIT_SUBSYSTEM_KIND &&
    movement.outputVtxoIds.length === 0 &&
    movement.exitedVtxoIds.length === 0
  )
}

export function getArkMovementAmountSats(movement: ArkMovement): number {
  return Math.abs(movement.effectiveBalanceSats)
}

export function parseArkCounterparty(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isRecord(parsed) && typeof parsed.value === 'string') {
      return parsed.value
    }
    return raw
  } catch {
    return raw
  }
}

export function truncateArkCounterparty(
  value: string,
  chars = COUNTERPARTY_TRUNCATE_CHARS
): string {
  if (value.length <= chars * 2 + 3) {
    return value
  }
  return `${value.slice(0, chars)}...${value.slice(-chars)}`
}

export function getArkMovementCounterparty(
  movement: ArkMovement
): string | null {
  const kind = getArkMovementKind(movement)
  if (kind === 'refresh') {
    return null
  }
  const list =
    kind === 'send' ? movement.sentToAddresses : movement.receivedOnAddresses
  const [first] = list
  if (!first) {
    return null
  }
  return parseArkCounterparty(first)
}
