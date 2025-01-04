import { useMutation, UseMutationResult } from '@tanstack/react-query'

import { useGetAccount } from '@/hooks/useGetAccount'
import { useAccountsStore } from '@/store/accounts'

export const useGetPrevAddress = (
  id: string
): UseMutationResult<void, Error> => {
  const { data: account } = useGetAccount(id)
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const getPrevAddress = async (): Promise<void> => {
    if (!account) {
      throw new Error('Account data is not available.')
    }
    if (Number(account.currentIndex) - 1 >= 0) {
      account.currentIndex = account.currentIndex - 1
      await updateAccount(account)
    }
  }

  return useMutation({
    mutationFn: getPrevAddress,
    onError: (error) => {
      throw new Error('Failed to generate a prev address:', error)
    }
  })
}
