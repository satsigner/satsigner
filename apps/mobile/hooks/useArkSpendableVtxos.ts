import type { ArkVtxo } from '@/types/models/Ark'

import { useArkVtxos } from './useArkVtxos'

function selectSpendable(vtxos: ArkVtxo[]): ArkVtxo[] {
  return vtxos.filter((vtxo) => vtxo.spendable)
}

export function useArkSpendableVtxos(accountId: string | null | undefined) {
  return useArkVtxos(accountId, selectSpendable)
}
