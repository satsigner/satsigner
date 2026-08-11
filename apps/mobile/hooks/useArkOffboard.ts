import { useMutation, useQueryClient } from '@tanstack/react-query'

import { offboardArkVtxos } from '@/api/ark'
import type { ArkOffboardInput } from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'
import { syncArkAccountAndInvalidate } from '@/utils/arkSync'

function executeArkOffboard(
  accountId: string,
  input: ArkOffboardInput
): Promise<string> {
  const account = getArkAccountOrThrow(accountId)
  return offboardArkVtxos(
    account.serverId,
    accountId,
    input.vtxoIds,
    input.bitcoinAddress
  )
}

export function useArkOffboard(accountId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation<string, Error, ArkOffboardInput>({
    mutationFn: (input) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      return executeArkOffboard(accountId, input)
    },
    onSuccess: () => {
      if (!accountId) {
        return
      }
      syncArkAccountAndInvalidate(queryClient, accountId)
    }
  })
}
