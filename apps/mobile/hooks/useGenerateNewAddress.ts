import { useMutation, UseMutationResult } from '@tanstack/react-query'

import { useGetAccount } from '@/hooks/useGetAccount'
import { useAccountsStore } from '@/store/accounts'

export const useGenerateNewAddress = (
  id: string
): UseMutationResult<void, Error> => {
  const { data: account } = useGetAccount(id)
  const updateAccount = useAccountsStore((state) => state.updateAccount)

  const generateNewAddress = async (): Promise<void> => {
    if (!account) {
      throw new Error('Account data is not available.')
    }

    account.usedIndexes.push(account.currentIndex)
    account.currentIndex += 1
    await updateAccount(account)
  }

  return useMutation({
    mutationFn: generateNewAddress,
    onError: (error) => {
      throw new Error('Failed to generate a new address:', error)
    }
  })
}
