import { useQuery } from '@tanstack/react-query'

import { ensureArkWalletOpen } from '@/services/arkWallet'

export function useArkWallet(accountId: string | null | undefined) {
  return useQuery({
    enabled: Boolean(accountId),
    gcTime: Infinity,
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      return ensureArkWalletOpen(accountId)
    },
    queryKey: ['ark', 'wallet', accountId],
    staleTime: Infinity
  })
}
