import type { ArkVtxo } from '@/types/models/Ark'

const ARK_VTXO_HISTORICAL_STATES = new Set(['spent', 'exited'])

export type ArkVtxoGroup = 'spendable' | 'locked'

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

export function sumArkVtxoSats(vtxos: ArkVtxo[], ids: Set<string>): number {
  return vtxos.reduce(
    (total, vtxo) => (ids.has(vtxo.id) ? total + vtxo.amountSats : total),
    0
  )
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
