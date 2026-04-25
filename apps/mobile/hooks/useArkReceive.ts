import { useMutation, useQuery } from '@tanstack/react-query'

import {
  type ArkBolt11Invoice,
  createArkBolt11Invoice,
  newArkAddress
} from '@/api/ark'
import { useArkStore } from '@/store/ark'

import { useArkWallet } from './useArkWallet'

function getAccountServerId(accountId: string) {
  const { accounts } = useArkStore.getState()
  const account = accounts.find((a) => a.id === accountId)
  if (!account) {
    throw new Error('Ark account not found')
  }
  return account.serverId
}

export function useArkAddress(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)

  return useQuery<string>({
    enabled: Boolean(walletReady && accountId),
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      return newArkAddress(getAccountServerId(accountId), accountId)
    },
    queryKey: ['ark', 'address', accountId],
    staleTime: Infinity
  })
}

export function useArkBolt11InvoiceMutation(
  accountId: string | null | undefined
) {
  return useMutation<ArkBolt11Invoice, Error, number>({
    mutationFn: (amountSats: number) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      return createArkBolt11Invoice(
        getAccountServerId(accountId),
        accountId,
        amountSats
      )
    }
  })
}
