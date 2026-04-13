import { useQuery } from '@tanstack/react-query'

import { labelKeys } from '../keys'
import { getLabelsByAccount } from '../queries/labels'

function useLabelsQuery(accountId: string) {
  return useQuery({
    queryFn: () => getLabelsByAccount(accountId),
    queryKey: labelKeys.all(accountId),
    staleTime: Infinity
  })
}

export { useLabelsQuery }
