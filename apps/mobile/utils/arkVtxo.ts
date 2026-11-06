import type { ArkBalance, ArkVtxo } from '@/types/models/Ark'
import { formatMaskedNumber } from '@/utils/format'
import type { PackedBubbleDatum } from '@/utils/packedBubbleLayout'

const ARK_VTXO_HISTORICAL_STATES = new Set(['spent', 'exited'])

type ArkVtxoGroup = 'spendable' | 'locked'

export function filterCurrentArkVtxos(vtxos: ArkVtxo[]): ArkVtxo[] {
  return vtxos.filter(
    (vtxo) => !ARK_VTXO_HISTORICAL_STATES.has(vtxo.state.toLowerCase())
  )
}

export type ArkVtxoListItem =
  | { type: 'header'; key: string; group: ArkVtxoGroup; count: number }
  | { type: 'vtxo'; key: string; vtxo: ArkVtxo }

export function filterSelectableVtxoIds(
  vtxos: ArkVtxo[],
  selectedIds: string[]
): string[] {
  const spendableIds = new Set(
    vtxos.filter((vtxo) => vtxo.spendable).map((vtxo) => vtxo.id)
  )
  return selectedIds.filter((id) => spendableIds.has(id))
}

export function getArkNextExpiryHeight(vtxos: ArkVtxo[]): number | null {
  const spendableHeights = vtxos
    .filter((vtxo) => vtxo.spendable)
    .map((vtxo) => vtxo.expiryHeight)
  if (spendableHeights.length === 0) {
    return null
  }
  return Math.min(...spendableHeights)
}

export function sumArkVtxoSats(
  vtxos: ArkVtxo[],
  ids: ReadonlySet<string>
): number {
  return vtxos.reduce(
    (total, vtxo) => (ids.has(vtxo.id) ? total + vtxo.amountSats : total),
    0
  )
}

export type ArkBusyVtxoIds = {
  exiting: ReadonlySet<string>
  inRound: ReadonlySet<string>
}

export function isArkVtxoBusy(vtxoId: string, busy: ArkBusyVtxoIds): boolean {
  return busy.exiting.has(vtxoId) || busy.inRound.has(vtxoId)
}

type ArkAvailableSats = Pick<ArkBalance, 'needsRefreshSats' | 'spendableSats'>

function takeAvailableSats(balance: ArkAvailableSats, sats: number) {
  const needsRefreshSats = balance.needsRefreshSats ?? 0
  const fromSpendable = Math.min(balance.spendableSats, sats)
  const fromNeedsRefresh = Math.min(needsRefreshSats, sats - fromSpendable)
  return {
    needsRefreshSats: needsRefreshSats - fromNeedsRefresh,
    spendableSats: balance.spendableSats - fromSpendable,
    takenSats: fromSpendable + fromNeedsRefresh
  }
}

export function moveBusyArkVtxosOutOfSpendable(
  balance: ArkBalance,
  spendableVtxos: ArkVtxo[],
  busy: ArkBusyVtxoIds
): ArkBalance {
  const inRoundOnly = new Set(
    [...busy.inRound].filter((id) => !busy.exiting.has(id))
  )
  const afterExits = takeAvailableSats(
    balance,
    sumArkVtxoSats(spendableVtxos, busy.exiting)
  )
  const afterRounds = takeAvailableSats(
    afterExits,
    sumArkVtxoSats(spendableVtxos, inRoundOnly)
  )
  return {
    ...balance,
    needsRefreshSats: afterRounds.needsRefreshSats,
    pendingExitSats: balance.pendingExitSats + afterExits.takenSats,
    pendingInRoundSats: balance.pendingInRoundSats + afterRounds.takenSats,
    spendableSats: afterRounds.spendableSats
  }
}

export function buildArkVtxoSections(vtxos: ArkVtxo[]): ArkVtxoListItem[] {
  const spendable = vtxos.filter((vtxo) => vtxo.spendable)
  const locked = vtxos.filter((vtxo) => !vtxo.spendable)

  const items: ArkVtxoListItem[] = []

  if (spendable.length > 0) {
    items.push({
      count: spendable.length,
      group: 'spendable',
      key: 'header-spendable',
      type: 'header'
    })
    for (const vtxo of spendable) {
      items.push({ key: vtxo.id, type: 'vtxo', vtxo })
    }
  }

  if (locked.length > 0) {
    items.push({
      count: locked.length,
      group: 'locked',
      key: 'header-locked',
      type: 'header'
    })
    for (const vtxo of locked) {
      items.push({ key: vtxo.id, type: 'vtxo', vtxo })
    }
  }

  return items
}

export function arkVtxosToBubbleData(
  vtxos: ArkVtxo[],
  selectedIds: string[],
  privacyMode: boolean
): PackedBubbleDatum[] {
  const selected = new Set(selectedIds)
  return vtxos.map((vtxo) => ({
    id: vtxo.id,
    label: formatMaskedNumber(vtxo.amountSats, privacyMode),
    locked: !vtxo.spendable,
    selected: selected.has(vtxo.id),
    value: vtxo.amountSats
  }))
}
