import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { router } from 'expo-router'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { fetchArkOnchainFeeRates } from '@/api/ark'
import {
  ARK_EXIT_POLL_INTERVAL_MS,
  ARK_EXIT_WATCH_INTERVAL_MS,
  ARK_EXIT_WATCH_QUERY_KEY,
  ARK_QUERY_STALE_TIME_MS
} from '@/constants/ark'
import { t } from '@/locales'
import {
  type ArkExitClaimRequest,
  claimArkExits,
  discardArkExitClaim,
  previewArkExitClaim,
  refreshArkExits,
  retryArkExitClaimBroadcast
} from '@/services/arkExitClaim'
import { prepareArkExitFunding } from '@/services/arkExitFunding'
import {
  type ClaimableArkExitsNotice,
  findNewlyClaimableArkExits,
  markArkExitsAnnounced
} from '@/services/arkExitWatch'
import { getArkAccountOrThrow, useArkStore } from '@/store/ark'
import { useArkExitClaimsStore } from '@/store/arkExitClaims'
import { type ArkExit } from '@/types/models/Ark'
import { arkBoardIoPreviewHref } from '@/utils/arkBoardDeposit'
import { getArkExitsRoute, isArkExitLive } from '@/utils/arkExit'

import { invalidateArkBoardQueries } from './useArkBoard'
import { arkExitFeeEstimateQueryKey } from './useArkExitFeeEstimate'
import { useArkWallet } from './useArkWallet'

export function arkExitsQueryKey(accountId: string | null | undefined) {
  return ['ark', 'exits', accountId]
}

function exitsRefetchInterval(exits: ArkExit[] | undefined): number | false {
  return exits?.some(isArkExitLive) ? ARK_EXIT_POLL_INTERVAL_MS : false
}

export function useArkExits(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery({
    queryFn:
      walletReady && accountId ? () => refreshArkExits(accountId) : skipToken,
    queryKey: arkExitsQueryKey(accountId),
    refetchInterval: (query) => exitsRefetchInterval(query.state.data),
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}

/** Reloads the exits and the fee funding they still wait for. */
export function useArkExitsRefresh(accountId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: arkExitsQueryKey(accountId) }),
      queryClient.invalidateQueries({
        queryKey: arkExitFeeEstimateQueryKey(accountId)
      }),
      queryClient.invalidateQueries({
        queryKey: ['ark', 'onchain-balance', accountId]
      })
    ])
}

export function useArkExitClaims(accountId: string | null | undefined) {
  return useArkExitClaimsStore(
    useShallow((state) =>
      state.claims.filter((claim) => claim.arkAccountId === accountId)
    )
  )
}

export function useArkOnchainFeeRates(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery({
    queryFn:
      walletReady && accountId
        ? () =>
            fetchArkOnchainFeeRates(
              getArkAccountOrThrow(accountId).serverId,
              accountId
            )
        : skipToken,
    queryKey: ['ark', 'onchain-fee-rates', accountId],
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}

export function useArkExitClaimPreview(
  request: ArkExitClaimRequest | undefined,
  claimableIds: string[]
) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: request ? () => previewArkExitClaim(request) : skipToken,
    queryKey: ['ark', 'exit-claim-preview', request, claimableIds.toSorted()],
    retry: false,
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}

function invalidateArkExitQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  accountId: string
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: arkExitsQueryKey(accountId) }),
    queryClient.invalidateQueries({
      queryKey: ['ark', 'exit-claim-preview']
    }),
    invalidateArkBoardQueries(queryClient, accountId)
  ]).then(() => undefined)
}

export function useArkExitClaim(accountId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: claimArkExits,
    mutationKey: ['ark', 'exit-claim', accountId],
    onSettled: () => invalidateArkExitQueries(queryClient, accountId)
  })
}

export function useArkExitClaimDiscard(accountId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (txid: string) => discardArkExitClaim(accountId, txid),
    mutationKey: ['ark', 'exit-claim', accountId, 'discard'],
    onSettled: () => invalidateArkExitQueries(queryClient, accountId)
  })
}

export function useArkExitClaimRetry(accountId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (txid: string) => retryArkExitClaimBroadcast(accountId, txid),
    mutationKey: ['ark', 'exit-claim', accountId, 'retry'],
    onSettled: () => invalidateArkExitQueries(queryClient, accountId)
  })
}

type ArkExitFundingInput = {
  fundingAccountId: string
  amountSats: number
}

export function useArkExitFunding(arkAccountId: string) {
  return useMutation({
    mutationFn: ({ fundingAccountId, amountSats }: ArkExitFundingInput) =>
      prepareArkExitFunding({ amountSats, arkAccountId, fundingAccountId }),
    onSuccess: (_, { fundingAccountId }) => {
      router.navigate(arkBoardIoPreviewHref(fundingAccountId))
    }
  })
}

function showClaimableNotice({
  accountId,
  accountName,
  count
}: ClaimableArkExitsNotice): void {
  toast.success(t('ark.exit.watch.claimable', { count, name: accountName }), {
    description: t('ark.exit.watch.claimableDescription'),
    onPress: () => router.navigate(getArkExitsRoute(accountId))
  })
}

async function announceClaimableArkExits(
  queryClient: ReturnType<typeof useQueryClient>
): Promise<number> {
  const notices = await findNewlyClaimableArkExits()
  for (const notice of notices) {
    // The notice opens the exits screen, which must already list them as
    // claimable.
    queryClient.invalidateQueries({
      queryKey: arkExitsQueryKey(notice.accountId)
    })
    showClaimableNotice(notice)
    markArkExitsAnnounced(notice)
  }
  return notices.length
}

/**
 * Watches every Ark account with an exit under way and tells the user when
 * one becomes claimable, whichever screen they are on.
 */
export function useArkExitWatcher() {
  const queryClient = useQueryClient()
  const hasPendingExits = useArkStore((state) =>
    Object.values(state.balances).some(
      (balance) => (balance?.pendingExitSats ?? 0) > 0
    )
  )
  return useQuery({
    enabled: hasPendingExits,
    queryFn: () => announceClaimableArkExits(queryClient),
    queryKey: ARK_EXIT_WATCH_QUERY_KEY,
    refetchInterval: ARK_EXIT_WATCH_INTERVAL_MS,
    retry: false
  })
}
