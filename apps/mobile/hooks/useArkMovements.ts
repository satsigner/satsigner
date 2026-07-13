import { useQuery } from '@tanstack/react-query'

import { fetchArkMovements } from '@/api/ark'
import { ARK_QUERY_STALE_TIME_MS } from '@/constants/ark'
import { useArkStore } from '@/store/ark'
import type { ArkMovement } from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'
import { selectArkRefreshes, selectArkTransactions } from '@/utils/arkMovement'

import { useArkWallet } from './useArkWallet'

export function useArkMovements(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  const updateStats = useArkStore((state) => state.updateStats)

  return useQuery<ArkMovement[]>({
    enabled: Boolean(walletReady && accountId),
    queryFn: async () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      const movements = await fetchArkMovements(account.serverId, accountId)
      updateStats(accountId, {
        numberOfRefreshes: selectArkRefreshes(movements).length,
        numberOfTransactions: selectArkTransactions(movements).length
      })
      return movements
    },
    queryKey: ['ark', 'movements', accountId],
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}
