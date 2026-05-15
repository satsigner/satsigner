import { decode } from 'bitcoin-decoder'

import {
  ARK_REFRESH_SUBSYSTEM_KEYWORD,
  ARK_LIGHTNING_SUBSYSTEM_KINDS,
  ARK_STALE_EXIT_SUBSYSTEM_NAME,
  ARK_STALE_EXIT_SUBSYSTEM_KIND,
  ARK_MUTED_STATUSES,
  ARK_COUNTERPARTY_TRUNCATE_CHARS
} from '@/constants/ark'
import { t } from '@/locales'
import type {
  ArkMovement,
  ArkMovementKind,
  ArkDestinationDraft,
  ArkDestinationParseResult,
  ArkSendKind
} from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFeeOnlyMovement(movement: ArkMovement): boolean {
  return (
    movement.offchainFeeSats > 0 &&
    movement.effectiveBalanceSats + movement.offchainFeeSats === 0
  )
}

export async function parseArkDestination(
  raw: string
): Promise<ArkDestinationParseResult> {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return { ok: false, reason: 'invalid' }
  }

  const decoded = await decode(trimmed)
  if (!decoded.valid) {
    return { ok: false, reason: 'invalid' }
  }

  const { destination, metadata } = decoded

  switch (destination.type) {
    case 'ark-address':
      return {
        draft: { address: destination.destination, kind: 'arkoor' },
        ok: true
      }
    case 'bolt11':
      return {
        draft: {
          amountSatsFromInvoice: metadata?.amount,
          description: metadata?.description,
          invoice: destination.destination,
          kind: 'bolt11'
        },
        ok: true
      }
    case 'lnaddress':
      return {
        draft: { address: destination.destination, kind: 'lnaddress' },
        ok: true
      }
    case 'lnurl':
      return {
        draft: { kind: 'lnurl', lnurl: destination.destination },
        ok: true
      }
    case 'bitcoin-address':
      return {
        draft: { address: destination.destination, kind: 'onchain' },
        ok: true
      }
    default:
      return { ok: false, reason: 'unsupported' }
  }
}

export function arkDestinationKindFromDraft(
  draft: ArkDestinationDraft
): ArkSendKind {
  return draft.kind
}

export function arkNetworkLabel(network: Network): string {
  if (network === 'bitcoin') {
    return t('ark.network.bitcoin')
  }
  return t('ark.network.signet')
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
