import { useQuery } from '@tanstack/react-query'

import { addressKeys } from '../keys'
import { getAddress, getAddressesByAccount } from '../queries/addresses'

function useAddressesQuery(accountId: string) {
  return useQuery({
    queryFn: () => getAddressesByAccount(accountId),
    queryKey: addressKeys.all(accountId),
    staleTime: Infinity
  })
}

function useAddressQuery(accountId: string, address: string) {
  return useQuery({
    queryFn: () => getAddress(accountId, address),
    queryKey: addressKeys.detail(accountId, address),
    staleTime: Infinity
  })
}

export { useAddressQuery, useAddressesQuery }
