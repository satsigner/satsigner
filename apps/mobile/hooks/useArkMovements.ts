import { useQuery } from '@tanstack/react-query'

import { fetchArkMovements } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import type { ArkMovement } from '@/types/models/Ark'

import { useArkWallet } from './useArkWallet'

export function useArkMovements(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)

  return useQuery<ArkMovement[]>({
    enabled: Boolean(walletReady && accountId),
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const { accounts } = useArkStore.getState()
      const account = accounts.find((a) => a.id === accountId)
      if (!account) {
        throw new Error('Ark account not found')
      }
      return fetchArkMovements(account.serverId, accountId)
    },
    queryKey: ['ark', 'movements', accountId]
  })
}
