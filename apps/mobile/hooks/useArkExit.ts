import { useMutation, useQueryClient } from '@tanstack/react-query'

import { startArkExit } from '@/api/ark'
import { getArkAccountOrThrow } from '@/store/ark'
import { syncArkAccountAndInvalidate } from '@/utils/arkSync'

import { arkExitsQueryKey } from './useArkExits'

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
    onSuccess: async () => {
      if (!accountId) {
        return
      }
      // Callers open the exits screen next; it must not show the list from
      // before this exit started.
      await queryClient.invalidateQueries({
        queryKey: arkExitsQueryKey(accountId),
        refetchType: 'all'
      })
      syncArkAccountAndInvalidate(queryClient, accountId)
    }
  })
}
