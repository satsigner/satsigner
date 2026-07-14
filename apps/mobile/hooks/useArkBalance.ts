import { useQuery } from '@tanstack/react-query'

import { fetchArkBalance } from '@/api/ark'
import { ARK_QUERY_STALE_TIME_MS } from '@/constants/ark'
import { useArkStore } from '@/store/ark'
import type { ArkBalance } from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'

import { useArkWallet } from './useArkWallet'

type UseArkBalanceOptions = {
  refetchIntervalMs?: number
}

export function useArkBalance(
  accountId: string | null | undefined,
  options: UseArkBalanceOptions = {}
) {
  const { data: walletReady } = useArkWallet(accountId)
  const updateBalance = useArkStore((state) => state.updateBalance)

  return useQuery<ArkBalance>({
    enabled: Boolean(walletReady && accountId),
    queryFn: async () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      const balance = await fetchArkBalance(account.serverId, accountId)
      updateBalance(accountId, balance)
      return balance
    },
    queryKey: ['ark', 'balance', accountId],
    refetchInterval: options.refetchIntervalMs ?? false,
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}
