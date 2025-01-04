import { useQuery, UseQueryResult } from '@tanstack/react-query'

import { useAccountsStore } from '@/store/accounts'
import { Account } from '@/types/models/Account'

export const useGetAccounts = (): UseQueryResult<Account[], Error> => {
  const getAllAccounts = useAccountsStore((state) => state.getAllAccounts)
  return useQuery({
    queryKey: ['accounts'],
    queryFn: getAllAccounts
  })
}
