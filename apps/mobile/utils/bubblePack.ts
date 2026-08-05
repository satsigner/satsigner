import { type Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/outpoint'
import { groupUtxos, type UtxoGroupMode } from '@/utils/utxoList'
import { groupDisplayTitle } from '@/utils/utxoListUi'

type BubblePackNode = {
  id: string
  value: number
  title?: string
  children: BubblePackNode[]
  utxo?: Utxo
}

function toLeafNode(utxo: Utxo): BubblePackNode {
  return {
    children: [],
    id: getUtxoOutpoint(utxo),
    utxo,
    value: utxo.value
  }
}

function buildBubblePackRoot(
  utxos: Utxo[],
  groupMode: UtxoGroupMode = 'none'
): BubblePackNode {
  if (groupMode === 'none') {
    return {
      children: utxos.map(toLeafNode),
      id: 'root',
      value: 0
    }
  }

  const groups = groupUtxos(utxos, groupMode)
  return {
    children: groups.map((group) => ({
      children: group.utxos.map(toLeafNode),
      id: `group:${group.key}`,
      title: groupDisplayTitle(groupMode, group.key, group.title),
      value: 0
    })),
    id: 'root',
    value: 0
  }
}

export { buildBubblePackRoot }
export type { BubblePackNode }
