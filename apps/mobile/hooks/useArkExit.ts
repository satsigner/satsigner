import { useMutation, useQueryClient } from '@tanstack/react-query'

import { startArkExit } from '@/api/ark'
import { getArkAccountOrThrow } from '@/utils/ark'
import { syncArkAccountAndInvalidate } from '@/utils/arkSync'

function executeArkExit(accountId: string, vtxoIds?: string[]): Promise<void> {
  const account = getArkAccountOrThrow(accountId)
  return startArkExit(account.serverId, accountId, vtxoIds)
}

export function useArkExit(accountId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vtxoIds: string[] | undefined) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      return executeArkExit(accountId, vtxoIds)
    },
    onSuccess: () => {
      if (!accountId) {
        return
      }
      syncArkAccountAndInvalidate(queryClient, accountId)
    }
  })
}
