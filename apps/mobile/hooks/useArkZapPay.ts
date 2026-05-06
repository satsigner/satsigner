import { useMutation, useQueryClient } from '@tanstack/react-query'

import { payArkBolt11 } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import { useZapFlowStore } from '@/store/zapFlow'
import type { ArkLightningSendResult } from '@/types/models/Ark'

type UseArkZapPayInput = {
  invoice: string
  amountSats: number
}

function getAccountServerId(accountId: string) {
  const { accounts } = useArkStore.getState()
  const account = accounts.find((a) => a.id === accountId)
  if (!account) {
    throw new Error('Ark account not found')
  }
  return account.serverId
}

export function useArkZapPay(accountId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation<ArkLightningSendResult, Error, UseArkZapPayInput>({
    mutationFn: ({ invoice, amountSats }) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      const serverId = getAccountServerId(accountId)
      return payArkBolt11(serverId, accountId, invoice, amountSats)
    },
    onSuccess: () => {
      useZapFlowStore.getState().setZapResult('success')
      if (!accountId) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['ark', 'balance', accountId]
      })
      queryClient.invalidateQueries({
        queryKey: ['ark', 'movements', accountId]
      })
    }
  })
}
