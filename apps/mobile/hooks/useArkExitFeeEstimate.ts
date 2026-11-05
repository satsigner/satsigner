import { skipToken, useQuery } from '@tanstack/react-query'

import { estimateArkEmergencyExitFee, fetchArkOnchainBalance } from '@/api/ark'
import {
  ARK_EXIT_POLL_INTERVAL_MS,
  ARK_QUERY_STALE_TIME_MS
} from '@/constants/ark'
import { getArkAccountOrThrow } from '@/store/ark'
import { type ArkEmergencyExitFee } from '@/types/models/Ark'
import {
  getArkExitFundingShortfall,
  isArkExitFundingConfirming
} from '@/utils/arkExit'

import { useArkWallet } from './useArkWallet'

export type ArkExitFeeEstimate = ArkEmergencyExitFee & {
  onchainConfirmedSats: number
  onchainPendingSats: number
  shortfallSats: number
  fundingConfirming: boolean
}

type UseArkExitFeeEstimateArgs = {
  accountId: string | null | undefined
  vtxoIds: string[]
  enabled: boolean
}

export function arkExitFeeEstimateQueryKey(
  accountId: string | null | undefined
) {
  return ['ark', 'exit-fee-estimate', accountId]
}

function fundingRefetchInterval(
  estimate: ArkExitFeeEstimate | undefined
): number | false {
  const waitingForFunds =
    !!estimate && (estimate.shortfallSats > 0 || estimate.fundingConfirming)
  return waitingForFunds ? ARK_EXIT_POLL_INTERVAL_MS : false
}

async function fetchArkExitFeeEstimate(
  accountId: string,
  vtxoIds: string[]
): Promise<ArkExitFeeEstimate> {
  const { serverId } = getArkAccountOrThrow(accountId)
  const [fee, onchainBalance] = await Promise.all([
    estimateArkEmergencyExitFee(serverId, accountId, vtxoIds),
    fetchArkOnchainBalance(serverId, accountId)
  ])
  const funding = {
    exitBroadcastFeeSats: fee.exitBroadcastFeeSats,
    onchainConfirmedSats: onchainBalance.confirmedSats,
    onchainPendingSats: onchainBalance.pendingSats
  }
  return {
    ...fee,
    ...funding,
    fundingConfirming: isArkExitFundingConfirming(funding),
    shortfallSats: getArkExitFundingShortfall(funding)
  }
}

/**
 * What exiting the given VTXOs would cost, and how much the on-chain wallet
 * that pays the exit transactions' fees is short of it.
 */
export function useArkExitFeeEstimate({
  accountId,
  vtxoIds,
  enabled
}: UseArkExitFeeEstimateArgs) {
  const { data: walletReady } = useArkWallet(accountId)
  const sortedIds = vtxoIds.toSorted()
  const ready = enabled && walletReady && accountId && sortedIds.length > 0
  return useQuery({
    queryFn: ready
      ? () => fetchArkExitFeeEstimate(accountId, sortedIds)
      : skipToken,
    queryKey: [...arkExitFeeEstimateQueryKey(accountId), sortedIds],
    refetchInterval: (query) => fundingRefetchInterval(query.state.data),
    retry: false,
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}
