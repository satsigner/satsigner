import { useMutation, useQueryClient } from '@tanstack/react-query'

import { payArkBolt11 } from '@/api/ark'
import { useZapFlowStore } from '@/store/zapFlow'
import type { ArkLightningSendResult } from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'
import { syncArkAccountAndInvalidate } from '@/utils/arkSync'

type UseArkZapPayInput = {
  invoice: string
  amountSats: number
}

export function useArkZapPay(accountId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation<ArkLightningSendResult, Error, UseArkZapPayInput>({
    mutationFn: ({ invoice, amountSats }) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      const { serverId } = getArkAccountOrThrow(accountId)
      return payArkBolt11(serverId, accountId, invoice, amountSats)
    },
    onSuccess: () => {
      useZapFlowStore.getState().setZapResult('success')
      if (!accountId) {
        return
      }
      syncArkAccountAndInvalidate(queryClient, accountId)
    }
  })
}
