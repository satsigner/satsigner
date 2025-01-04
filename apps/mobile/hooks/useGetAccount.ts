import { useQuery, UseQueryResult } from '@tanstack/react-query'

import { useAccountsStore } from '@/store/accounts'
import { Account } from '@/types/models/Account'

export const useGetAccount = (id: string): UseQueryResult<Account, Error> => {
  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)
  return useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      return await getCurrentAccount(id)
    }
  })
}
