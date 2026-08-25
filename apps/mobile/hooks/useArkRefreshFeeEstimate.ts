import { useQuery } from '@tanstack/react-query'

import { estimateArkRefreshFee } from '@/api/ark'
import type { ArkFeeEstimate } from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'

import { useArkWallet } from './useArkWallet'

type UseArkRefreshFeeEstimateArgs = {
  accountId: string | null | undefined
  vtxoIds: string[]
  enabled: boolean
}

export function useArkRefreshFeeEstimate({
  accountId,
  vtxoIds,
  enabled
}: UseArkRefreshFeeEstimateArgs) {
  const { data: walletReady } = useArkWallet(accountId)
  const sortedIds = [...vtxoIds].toSorted()

  return useQuery<ArkFeeEstimate, Error>({
    enabled:
      enabled && Boolean(walletReady && accountId) && sortedIds.length > 0,
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return estimateArkRefreshFee(account.serverId, accountId, sortedIds)
    },
    queryKey: ['ark', 'refresh-fee-estimate', accountId, sortedIds],
    retry: false,
    staleTime: 30_000
  })
}
