import {
  ARK_REFRESH_SUBSYSTEM_KEYWORD,
  ARK_LIGHTNING_SUBSYSTEM_KINDS,
  ARK_STALE_EXIT_SUBSYSTEM_NAME,
  ARK_STALE_EXIT_SUBSYSTEM_KIND,
  ARK_MUTED_STATUSES,
  ARK_COUNTERPARTY_TRUNCATE_CHARS
} from '@/constants/ark'
import { t } from '@/locales'
import type { ArkMovement, ArkMovementKind } from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

export function arkNetworkLabel(network: Network): string {
  if (network === 'bitcoin') {
    return t('ark.network.bitcoin')
  }
  return t('ark.network.signet')
}

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
    movement.subsystemName.toLowerCase().includes(ARK_REFRESH_SUBSYSTEM_KEYWORD)
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
  if (movement.intendedBalanceSats > 0) {
    return 'receive'
  }
  if (movement.intendedBalanceSats < 0) {
    return 'send'
  }
  return 'refresh'
}

export function isLightningMovement(movement: ArkMovement): boolean {
  return ARK_LIGHTNING_SUBSYSTEM_KINDS.has(movement.subsystemKind.toLowerCase())
}

export function isStaleArkExitMovement(movement: ArkMovement): boolean {
  return (
    movement.subsystemName === ARK_STALE_EXIT_SUBSYSTEM_NAME &&
    movement.subsystemKind === ARK_STALE_EXIT_SUBSYSTEM_KIND &&
    movement.outputVtxoIds.length === 0 &&
    movement.exitedVtxoIds.length === 0
  )
}

export function isMutedArkMovement(movement: ArkMovement): boolean {
  if (isStaleArkExitMovement(movement)) {
    return true
  }
  return ARK_MUTED_STATUSES.has(movement.status)
}

export function getArkMovementAmountSats(movement: ArkMovement): number {
  if (movement.effectiveBalanceSats !== 0) {
    return Math.abs(movement.effectiveBalanceSats)
  }
  return Math.abs(movement.intendedBalanceSats)
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
  chars = ARK_COUNTERPARTY_TRUNCATE_CHARS
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
