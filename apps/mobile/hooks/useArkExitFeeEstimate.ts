import { skipToken, useQuery } from '@tanstack/react-query'

import { estimateArkEmergencyExitFee } from '@/api/ark'
import {
  ARK_EXIT_POLL_INTERVAL_MS,
  ARK_QUERY_STALE_TIME_MS
} from '@/constants/ark'
import { getArkAccountOrThrow } from '@/store/ark'
import { getArkExitFunding } from '@/utils/arkExit'

import { useArkOnchainBalance } from './useArkBoard'
import { useArkWallet } from './useArkWallet'

type UseArkExitFeeEstimateArgs = {
  accountId: string | null | undefined
  vtxoIds: string[]
  enabled: boolean
  // Keeps the estimate fresh while the exits it covers are under way, since
  // fee rates move on their own.
  poll?: boolean
}

export function arkExitFeeEstimateQueryKey(
  accountId: string | null | undefined
) {
  return ['ark', 'exit-fee-estimate', accountId]
}

/** What exiting the given VTXOs would cost. */
export function useArkExitFeeEstimate({
  accountId,
  vtxoIds,
  enabled,
  poll = false
}: UseArkExitFeeEstimateArgs) {
  const { data: walletReady } = useArkWallet(accountId)
  const sortedIds = vtxoIds.toSorted()
  const ready = enabled && walletReady && accountId && sortedIds.length > 0
  return useQuery({
    queryFn: ready
      ? () =>
          estimateArkEmergencyExitFee(
            getArkAccountOrThrow(accountId).serverId,
            accountId,
            sortedIds
          )
      : skipToken,
    queryKey: [...arkExitFeeEstimateQueryKey(accountId), sortedIds],
    refetchInterval: poll ? ARK_EXIT_POLL_INTERVAL_MS : false,
    retry: false,
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}

type UseArkExitFeeFundingArgs = {
  accountId: string | null | undefined
  exitBroadcastFeeSats: number | undefined
  enabled: boolean
}

/**
 * How much the on-chain wallet that pays the exit transactions' fees is short
 * of them. Read apart from the fee, so a slow or failed wallet sync never
 * holds the fee back.
 */
export function useArkExitFeeFunding({
  accountId,
  exitBroadcastFeeSats,
  enabled
}: UseArkExitFeeFundingArgs) {
  const balanceQuery = useArkOnchainBalance(accountId, { enabled })
  const balance = balanceQuery.data
  const funding =
    exitBroadcastFeeSats === undefined || !balance
      ? undefined
      : getArkExitFunding({
          exitBroadcastFeeSats,
          onchainConfirmedSats: balance.confirmedSats,
          onchainPendingSats: balance.pendingSats
        })
  return { balanceQuery, funding }
}
