import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  payArkBolt11,
  payArkLightningAddress,
  sendArkArkoor,
  sendArkOnchain
} from '@/api/ark'
import type { ArkSendInput, ArkSendOutcome } from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'
import { syncArkAccountAndInvalidate } from '@/utils/arkSync'
import { handleLNURLPay } from '@/utils/lnurl'

export async function executeArkSend(
  accountId: string,
  input: ArkSendInput
): Promise<ArkSendOutcome> {
  const { serverId } = getArkAccountOrThrow(accountId)

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

  if (input.kind === 'onchain') {
    const txid = await sendArkOnchain(
      serverId,
      accountId,
      input.address,
      input.amountSats
    )
    return { amountSats: input.amountSats, kind: 'onchain', txid }
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
      syncArkAccountAndInvalidate(queryClient, accountId)
    }
  })
}
