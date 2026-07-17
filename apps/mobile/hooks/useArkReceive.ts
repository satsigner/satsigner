import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createArkBolt11Invoice, newArkAddress } from '@/api/ark'
import { ArkBolt11Invoice } from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'

import { useArkWallet } from './useArkWallet'

export function useArkAddress(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  const queryClient = useQueryClient()

  return useQuery<string>({
    enabled: Boolean(walletReady && accountId),
    queryFn: async () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const address = await newArkAddress(
        getArkAccountOrThrow(accountId).serverId,
        accountId
      )
      // Each fetch reveals a new address, so the addresses list must rescan.
      queryClient.invalidateQueries({
        queryKey: ['ark', 'addresses', accountId]
      })
      return address
    },
    queryKey: ['ark', 'address', accountId],
    staleTime: Infinity
  })
}

type CreateBolt11InvoiceInput = {
  amountSats: number
  description?: string
}

export function useArkBolt11InvoiceMutation(
  accountId: string | null | undefined
) {
  return useMutation<ArkBolt11Invoice, Error, CreateBolt11InvoiceInput>({
    mutationFn: ({ amountSats, description }) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      return createArkBolt11Invoice(
        getArkAccountOrThrow(accountId).serverId,
        accountId,
        amountSats,
        description
      )
    }
  })
}
