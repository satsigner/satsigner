import { useQuery } from '@tanstack/react-query'

import { fetchArkBalance } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import type { ArkBalance } from '@/types/models/Ark'

import { useArkWallet } from './useArkWallet'

export function useArkBalance(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  const updateBalance = useArkStore((state) => state.updateBalance)

  return useQuery<ArkBalance>({
    enabled: Boolean(walletReady && accountId),
    queryFn: async () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const { accounts } = useArkStore.getState()
      const account = accounts.find((a) => a.id === accountId)
      if (!account) {
        throw new Error('Ark account not found')
      }
      const balance = await fetchArkBalance(account.serverId, accountId)
      updateBalance(accountId, balance)
      return balance
    },
    queryKey: ['ark', 'balance', accountId]
  })
}
