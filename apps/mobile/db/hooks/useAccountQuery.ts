import { useQuery } from '@tanstack/react-query'

import { accountKeys } from '../keys'
import { getAccountById, getAccounts } from '../queries/accounts'

function useAccountQuery(id: string) {
  return useQuery({
    queryFn: () => getAccountById(id),
    queryKey: accountKeys.detail(id),
    staleTime: Infinity
  })
}

function useAccountsQuery() {
  return useQuery({
    queryFn: () => getAccounts(),
    queryKey: accountKeys.all,
    staleTime: Infinity
  })
}

export { useAccountQuery, useAccountsQuery }
