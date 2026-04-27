import { useMutation, useQueryClient } from '@tanstack/react-query'

import { payArkBolt11, payArkLightningAddress, sendArkArkoor } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import type { ArkSendInput, ArkSendOutcome } from '@/types/models/Ark'
import { handleLNURLPay } from '@/utils/lnurl'

function getAccountServerId(accountId: string) {
  const { accounts } = useArkStore.getState()
  const account = accounts.find((a) => a.id === accountId)
  if (!account) {
    throw new Error('Ark account not found')
  }
  return account.serverId
}

async function executeArkSend(
  accountId: string,
  input: ArkSendInput
): Promise<ArkSendOutcome> {
  const serverId = getAccountServerId(accountId)

  if (input.kind === 'arkoor') {
    const txid = await sendArkArkoor(
      serverId,
      accountId,
      input.address,
      input.amountSats
    )
    return { amountSats: input.amountSats, kind: 'arkoor', txid }
  }

  if (input.kind === 'bolt11') {
    const result = await payArkBolt11(
      serverId,
      accountId,
      input.invoice,
      input.amountSats
    )
    return {
      amountSats: result.amountSats,
      invoice: result.invoice,
      kind: 'bolt11',
      preimage: result.preimage
    }
  }

  if (input.kind === 'lnaddress') {
    const result = await payArkLightningAddress(
      serverId,
      accountId,
      input.address,
      input.amountSats,
      input.comment
    )
    return {
      amountSats: result.amountSats,
      invoice: result.invoice,
      kind: 'lnaddress',
      preimage: result.preimage
    }
  }

  const invoice = await handleLNURLPay(
    input.lnurl,
    input.amountSats,
    input.comment
  )
  const result = await payArkBolt11(
    serverId,
    accountId,
    invoice,
    input.amountSats
  )
  return {
    amountSats: result.amountSats,
    invoice: result.invoice,
    kind: 'lnurl',
    preimage: result.preimage
  }
}

export function useArkSend(accountId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation<ArkSendOutcome, Error, ArkSendInput>({
    mutationFn: (input) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      return executeArkSend(accountId, input)
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
    }
  })
}
