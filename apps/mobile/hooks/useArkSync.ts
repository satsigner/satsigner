import { useMutation, useQueryClient } from '@tanstack/react-query'

import { syncArkAccountAndInvalidate } from '@/utils/arkSync'

export function useArkSync(accountId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      return syncArkAccountAndInvalidate(queryClient, accountId)
    }
  })
}
