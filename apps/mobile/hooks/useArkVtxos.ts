import { useQuery } from '@tanstack/react-query'

import { listArkVtxos } from '@/api/ark'
import { ARK_QUERY_STALE_TIME_MS } from '@/constants/ark'
import type { ArkVtxo } from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'

import { useArkWallet } from './useArkWallet'

export function useArkVtxos<T = ArkVtxo[]>(
  accountId: string | null | undefined,
  select?: (vtxos: ArkVtxo[]) => T
) {
  const { data: walletReady } = useArkWallet(accountId)

  return useQuery<ArkVtxo[], Error, T>({
    enabled: Boolean(walletReady && accountId),
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return listArkVtxos(account.serverId, accountId)
    },
    queryKey: ['ark', 'vtxos', accountId],
    select,
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}
