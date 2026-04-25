import { useQuery } from '@tanstack/react-query'

import { listArkSpendableVtxos } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import type { ArkVtxo } from '@/types/models/Ark'

import { useArkWallet } from './useArkWallet'

export function useArkSpendableVtxos(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)

  return useQuery<ArkVtxo[]>({
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
      return listArkSpendableVtxos(account.serverId, accountId)
    },
    queryKey: ['ark', 'spendable-vtxos', accountId]
  })
}
