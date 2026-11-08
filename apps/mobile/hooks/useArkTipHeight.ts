import { useQuery } from '@tanstack/react-query'

import { fetchArkTipHeight } from '@/api/ark'
import { ARK_QUERY_STALE_TIME_MS } from '@/constants/ark'
import { getArkAccountOrThrow } from '@/store/ark'

import { useArkWallet } from './useArkWallet'

export function useArkTipHeight(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery<number, Error>({
    enabled: Boolean(walletReady && accountId),
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return fetchArkTipHeight(account.serverId, accountId)
    },
    queryKey: ['ark', 'tip-height', accountId],
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}
