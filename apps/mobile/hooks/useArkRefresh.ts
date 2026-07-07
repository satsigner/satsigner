import { useMutation, useQueryClient } from '@tanstack/react-query'

import { refreshArkVtxos } from '@/api/ark'
import { getArkAccountOrThrow } from '@/utils/ark'
import { syncArkAccountAndInvalidate } from '@/utils/arkSync'

function executeArkRefresh(
  accountId: string,
  vtxoIds: string[]
): Promise<string> {
  const account = getArkAccountOrThrow(accountId)
  return refreshArkVtxos(account.serverId, accountId, vtxoIds)
}

export function useArkRefresh(accountId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation<string, Error, string[]>({
    mutationFn: (vtxoIds) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      return executeArkRefresh(accountId, vtxoIds)
    },
    onSuccess: () => {
      if (!accountId) {
        return
      }
      syncArkAccountAndInvalidate(queryClient, accountId)
    }
  })
}
