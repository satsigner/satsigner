import { useQuery } from '@tanstack/react-query'

import { utxoKeys } from '../keys'
import { getUtxosByAccount } from '../queries/utxos'

function useUtxosQuery(accountId: string) {
  return useQuery({
    queryFn: () => getUtxosByAccount(accountId),
    queryKey: utxoKeys.all(accountId),
    staleTime: Infinity
  })
}

export { useUtxosQuery }
