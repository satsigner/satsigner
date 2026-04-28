import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  estimateArkArkoorFee,
  estimateArkLightningSendFee,
  estimateArkSendOnchainFee
} from '@/api/ark'
import { useArkStore } from '@/store/ark'
import type { ArkFeeEstimate } from '@/types/models/Ark'

import { useArkWallet } from './useArkWallet'

export type ArkSendFeeKind = 'arkoor' | 'lightning' | 'onchain'

type UseArkSendFeeEstimateArgs = {
  accountId: string | null | undefined
  kind: ArkSendFeeKind | null
  amountSats: number
  bitcoinAddress?: string
}

export function useArkSendFeeEstimate({
  accountId,
  kind,
  amountSats,
  bitcoinAddress
}: UseArkSendFeeEstimateArgs) {
  const { data: walletReady } = useArkWallet(accountId)
  const trimmedAddress = bitcoinAddress?.trim() ?? ''
  const onchainReady = kind !== 'onchain' || trimmedAddress.length > 0

  return useQuery<ArkFeeEstimate, Error>({
    enabled:
      Boolean(walletReady && accountId) &&
      !!kind &&
      amountSats > 0 &&
      onchainReady,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (!accountId || !kind) {
        throw new Error('Ark fee estimate requires accountId and kind')
      }
      const { accounts } = useArkStore.getState()
      const account = accounts.find((a) => a.id === accountId)
      if (!account) {
        throw new Error('Ark account not found')
      }
      if (kind === 'arkoor') {
        return estimateArkArkoorFee(account.serverId, accountId, amountSats)
      }
      if (kind === 'onchain') {
        return estimateArkSendOnchainFee(
          account.serverId,
          accountId,
          trimmedAddress,
          amountSats
        )
      }
      return estimateArkLightningSendFee(
        account.serverId,
        accountId,
        amountSats
      )
    },
    queryKey: [
      'ark',
      'fee-estimate',
      accountId,
      kind,
      amountSats,
      trimmedAddress
    ],
    retry: false,
    staleTime: 30_000
  })
}
