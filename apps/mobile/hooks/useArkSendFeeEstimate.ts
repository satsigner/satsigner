import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { estimateArkArkoorFee, estimateArkLightningSendFee } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import type { ArkFeeEstimate } from '@/types/models/Ark'

import { useArkWallet } from './useArkWallet'

export type ArkSendFeeKind = 'arkoor' | 'lightning'

type UseArkSendFeeEstimateArgs = {
  accountId: string | null | undefined
  kind: ArkSendFeeKind | null
  amountSats: number
}

export function useArkSendFeeEstimate({
  accountId,
  kind,
  amountSats
}: UseArkSendFeeEstimateArgs) {
  const { data: walletReady } = useArkWallet(accountId)

  return useQuery<ArkFeeEstimate, Error>({
    enabled: Boolean(walletReady && accountId) && !!kind && amountSats > 0,
    queryFn: () => {
      if (!accountId || !kind) {
        throw new Error('Ark fee estimate requires accountId and kind')
      }
      const { accounts } = useArkStore.getState()
      const account = accounts.find((a) => a.id === accountId)
      if (!account) {
        throw new Error('Ark account not found')
      }
      if (kind === 'arkoor') {
        return estimateArkArkoorFee(account.serverId, accountId, amountSats)
      }
      return estimateArkLightningSendFee(
        account.serverId,
        accountId,
        amountSats
      )
    },
    placeholderData: keepPreviousData,
    queryKey: ['ark', 'fee-estimate', accountId, kind, amountSats],
    retry: false,
    staleTime: 30_000
  })
}
