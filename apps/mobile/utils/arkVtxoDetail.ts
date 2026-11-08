import type { VtxoData, VtxoPolicy, VtxoTransition } from 'bitcoin-decoder'
import type { Href } from 'expo-router'

import {
  ARK_VTXO_EXPIRY_WARNING_BLOCKS,
  ARK_VTXO_LINEAGE_EDGE_STEPS
} from '@/constants/ark'
import { TARGET_BLOCK_TIME_SECONDS } from '@/constants/consensus'
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/constants/time'
import type { ArkMovement } from '@/types/models/Ark'

export type ArkVtxoExpiryUrgency = 'ok' | 'soon' | 'expired'

export type ArkVtxoExpiry = {
  blocksLeft: number
  elapsedRatio: number
  urgency: ArkVtxoExpiryUrgency
}

export type ArkVtxoEta = {
  unit: 'days' | 'hours'
  count: number
}

export type ArkVtxoTransitionKind = 'cosigned' | 'arkoor' | 'roundLeaf'

export type ArkVtxoLineageStep = {
  txid: string
  transition: ArkVtxoTransitionKind
  inputSats: number
  outputSats: number
  feeSats: number
  siblingCount: number
  siblingSats: number
  signed: boolean
}

export type ArkVtxoMovements = {
  createdBy?: ArkMovement
  spentBy?: ArkMovement
}

type GetArkVtxoExpiryParams = {
  expiryHeight: number
  tipHeight: number
  lifetimeBlocks: number
}

function getArkVtxoExpiryUrgency(blocksLeft: number): ArkVtxoExpiryUrgency {
  if (blocksLeft === 0) {
    return 'expired'
  }
  if (blocksLeft <= ARK_VTXO_EXPIRY_WARNING_BLOCKS) {
    return 'soon'
  }
  return 'ok'
}

function getArkVtxoElapsedRatio(blocksLeft: number, lifetimeBlocks: number) {
  if (lifetimeBlocks <= 0) {
    return 1
  }
  return Math.min(1, Math.max(0, 1 - blocksLeft / lifetimeBlocks))
}

/** How far a VTXO is through its lifetime, measured against the chain tip. */
export function getArkVtxoExpiry({
  expiryHeight,
  tipHeight,
  lifetimeBlocks
}: GetArkVtxoExpiryParams): ArkVtxoExpiry {
  const blocksLeft = Math.max(0, expiryHeight - tipHeight)
  return {
    blocksLeft,
    elapsedRatio: getArkVtxoElapsedRatio(blocksLeft, lifetimeBlocks),
    urgency: getArkVtxoExpiryUrgency(blocksLeft)
  }
}

/** Rough wall-clock time for a number of blocks, in days or hours. */
export function getArkVtxoEta(blocks: number): ArkVtxoEta {
  const seconds = blocks * TARGET_BLOCK_TIME_SECONDS
  if (seconds >= SECONDS_PER_DAY) {
    return { count: Math.round(seconds / SECONDS_PER_DAY), unit: 'days' }
  }
  return {
    count: Math.max(1, Math.round(seconds / SECONDS_PER_HOUR)),
    unit: 'hours'
  }
}

function getArkVtxoTransitionKind(
  kind: VtxoTransition['kind']
): ArkVtxoTransitionKind {
  switch (kind) {
    case 'cosigned': {
      return 'cosigned'
    }
    case 'arkoor': {
      return 'arkoor'
    }
    case 'hash-locked-cosigned':
    case 'hash-locked-cosigned-v1': {
      return 'roundLeaf'
    }
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

/**
 * The exit transactions from the on-chain anchor down to the VTXO, each with
 * the sibling outputs that branch off the path at that level.
 */
export function buildArkVtxoLineage(
  data: Pick<VtxoData, 'exitChain' | 'genesis'>
): ArkVtxoLineageStep[] {
  return data.exitChain.flatMap((step, index) => {
    const item = data.genesis.at(index)
    if (!item) {
      return []
    }
    return [
      {
        feeSats: step.feeAmount,
        inputSats: step.inputAmount,
        outputSats: step.outputAmount,
        siblingCount: item.otherOutputs.length,
        siblingSats: item.otherOutputs.reduce(
          (total, output) => total + output.value,
          0
        ),
        signed: step.isSigned,
        transition: getArkVtxoTransitionKind(item.transition.kind),
        txid: step.txid
      }
    ]
  })
}

/** The movements that created and later spent or exited a VTXO. */
export function findArkVtxoMovements(
  movements: ArkMovement[],
  vtxoId: string
): ArkVtxoMovements {
  return {
    createdBy: movements.find((movement) =>
      movement.outputVtxoIds.includes(vtxoId)
    ),
    spentBy: movements.find(
      (movement) =>
        movement.inputVtxoIds.includes(vtxoId) ||
        movement.exitedVtxoIds.includes(vtxoId)
    )
  }
}

export type ArkVtxoLineageView = {
  head: ArkVtxoLineageStep[]
  hiddenCount: number
  tail: ArkVtxoLineageStep[]
  tailStartIndex: number
}

/** Long exit paths show their first and last levels around a collapsed gap. */
export function getArkVtxoLineageView(
  steps: ArkVtxoLineageStep[],
  expanded: boolean
): ArkVtxoLineageView {
  const collapsedLength = ARK_VTXO_LINEAGE_EDGE_STEPS * 2
  if (expanded || steps.length <= collapsedLength + 1) {
    return {
      head: steps,
      hiddenCount: 0,
      tail: [],
      tailStartIndex: steps.length
    }
  }
  const tailStartIndex = steps.length - ARK_VTXO_LINEAGE_EDGE_STEPS
  return {
    head: steps.slice(0, ARK_VTXO_LINEAGE_EDGE_STEPS),
    hiddenCount: tailStartIndex - ARK_VTXO_LINEAGE_EDGE_STEPS,
    tail: steps.slice(tailStartIndex),
    tailStartIndex
  }
}

/** Exiting alone costs at least what the VTXO holds. */
export function isArkVtxoExitUneconomical(
  amountSats: number,
  exitFeeSats: number
) {
  return exitFeeSats >= amountSats
}

/** The key a VTXO's policy pays to, when the policy names one. */
export function getArkVtxoPolicyKey(policy: VtxoPolicy): string | undefined {
  if ('userPubkey' in policy) {
    return policy.userPubkey
  }
  if ('internalKey' in policy) {
    return policy.internalKey
  }
  return undefined
}

/** The lightning payment hash a VTXO's HTLC policy is locked to. */
export function getArkVtxoPolicyPaymentHash(
  policy: VtxoPolicy
): string | undefined {
  if ('paymentHash' in policy) {
    return policy.paymentHash
  }
  return undefined
}

export function getArkVtxoRoute(accountId: string, vtxoId: string): Href {
  return `/signer/ark/account/${accountId}/vtxo/${encodeURIComponent(vtxoId)}`
}
