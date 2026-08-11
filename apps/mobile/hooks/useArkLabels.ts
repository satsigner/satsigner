import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { arkLabelKeys } from '@/db/keys'
import { setArkLabel } from '@/db/mutations/arkLabels'
import { getArkLabelsByAccount } from '@/db/queries/arkLabels'
import type { Label } from '@/types/bips/329'

export function useArkLabels(accountId: string | null | undefined) {
  return useQuery<Record<string, Label>>({
    enabled: Boolean(accountId),
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      return getArkLabelsByAccount(accountId)
    },
    queryKey: arkLabelKeys.all(accountId),
    staleTime: Infinity
  })
}

type SetArkLabelInput = {
  ref: string
  type: Label['type']
  label: string
}

export function useSetArkLabel(accountId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ref, type, label }: SetArkLabelInput) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      setArkLabel(accountId, ref, type, label)
      return Promise.resolve()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: arkLabelKeys.all(accountId) })
    }
  })
}
