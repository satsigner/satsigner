import { useMutation, useQueryClient } from '@tanstack/react-query'

import { offboardArkVtxos } from '@/api/ark'
import { useArkStore } from '@/store/ark'

type ArkOffboardInput = {
  vtxoIds: string[]
  bitcoinAddress: string
}

function executeArkOffboard(
  accountId: string,
  input: ArkOffboardInput
): Promise<string> {
  const { accounts } = useArkStore.getState()
  const account = accounts.find((a) => a.id === accountId)
  if (!account) {
    throw new Error('Ark account not found')
  }
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
      queryClient.invalidateQueries({
        queryKey: ['ark', 'balance', accountId]
      })
      queryClient.invalidateQueries({
        queryKey: ['ark', 'movements', accountId]
      })
      queryClient.invalidateQueries({
        queryKey: ['ark', 'spendable-vtxos', accountId]
      })
    }
  })
}
