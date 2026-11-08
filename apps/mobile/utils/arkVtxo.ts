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

export function sumArkVtxoSats(vtxos: ArkVtxo[], ids: Set<string>): number {
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

export type ArkRefreshThresholds = {
  maxExitDepth?: number
  tipHeight?: number
}

export function isArkVtxoNeedingRefresh(
  vtxo: ArkVtxo,
  { maxExitDepth, tipHeight }: ArkRefreshThresholds
): boolean {
  const expired = tipHeight !== undefined && vtxo.expiryHeight <= tipHeight
  const tooDeep = maxExitDepth !== undefined && vtxo.exitDepth >= maxExitDepth
  return expired || tooDeep
}

type ArkAvailableSats = {
  needsRefreshSats: number
  spendableSats: number
}

function totalArkVtxoSats(vtxos: ArkVtxo[]): number {
  return vtxos.reduce((total, vtxo) => total + vtxo.amountSats, 0)
}

function splitArkAvailableSats(
  vtxos: ArkVtxo[],
  thresholds: ArkRefreshThresholds
): ArkAvailableSats {
  const needsRefreshSats = totalArkVtxoSats(
    vtxos.filter((vtxo) => isArkVtxoNeedingRefresh(vtxo, thresholds))
  )
  return {
    needsRefreshSats,
    spendableSats: totalArkVtxoSats(vtxos) - needsRefreshSats
  }
}

function takeSats(available: number, wanted: number) {
  const taken = Math.min(available, wanted)
  return { left: available - taken, taken }
}

// bark sorts VTXOs into buckets against its own chain tip, which can be a
// block apart from ours, so a shortfall in one bucket comes out of the other
// and the total stays put.
function takeAvailableSats(
  available: ArkAvailableSats,
  wanted: ArkAvailableSats
) {
  const spendable = takeSats(available.spendableSats, wanted.spendableSats)
  const needsRefresh = takeSats(
    available.needsRefreshSats,
    wanted.needsRefreshSats
  )
  const shortSats =
    wanted.spendableSats +
    wanted.needsRefreshSats -
    spendable.taken -
    needsRefresh.taken
  const spendableOverflow = takeSats(spendable.left, shortSats)
  const needsRefreshOverflow = takeSats(
    needsRefresh.left,
    shortSats - spendableOverflow.taken
  )
  return {
    needsRefreshSats: needsRefreshOverflow.left,
    spendableSats: spendableOverflow.left,
    takenSats:
      spendable.taken +
      needsRefresh.taken +
      spendableOverflow.taken +
      needsRefreshOverflow.taken
  }
}

export function moveBusyArkVtxosOutOfSpendable(
  balance: ArkBalance,
  spendableVtxos: ArkVtxo[],
  busy: ArkBusyVtxoIds,
  thresholds: ArkRefreshThresholds
): ArkBalance {
  const exiting = spendableVtxos.filter((vtxo) => busy.exiting.has(vtxo.id))
  const inRound = spendableVtxos.filter(
    (vtxo) => busy.inRound.has(vtxo.id) && !busy.exiting.has(vtxo.id)
  )
  const available = {
    needsRefreshSats: balance.needsRefreshSats ?? 0,
    spendableSats: balance.spendableSats
  }
  const afterExits = takeAvailableSats(
    available,
    splitArkAvailableSats(exiting, thresholds)
  )
  const afterRounds = takeAvailableSats(
    afterExits,
    splitArkAvailableSats(inRound, thresholds)
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
