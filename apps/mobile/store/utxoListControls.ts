import { create } from 'zustand'

import { type Direction } from '@/types/logic/sort'
import { type UtxoGroupMode, type UtxoSortField } from '@/utils/utxoList'

type UtxoListControlsState = {
  groupMode: UtxoGroupMode
  sortDirection: Direction
  sortField: UtxoSortField
}

type UtxoListControlsAction = {
  setGroupMode: (mode: UtxoGroupMode) => void
  setSort: (field: UtxoSortField, direction: Direction) => void
}

const useUtxoListControlsStore = create<
  UtxoListControlsState & UtxoListControlsAction
>()((set) => ({
  groupMode: 'none',
  setGroupMode: (groupMode) => set({ groupMode }),
  setSort: (sortField, sortDirection) => set({ sortDirection, sortField }),
  sortDirection: 'desc',
  sortField: 'amount'
}))

export { useUtxoListControlsStore }
