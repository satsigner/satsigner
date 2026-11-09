import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import {
  boardArk,
  fetchArkOnchainBalance,
  fetchArkServerInfo,
  getArkBoardFundingAddress,
  listArkPendingBoards,
  newArkOnchainAddress
} from '@/api/ark'
import { withArkOnchainSpendLock } from '@/services/arkOnchainSpendLock'
import { getArkAccountOrThrow, useArkStore } from '@/store/ark'
import type {
  ArkBoardFundingInfo,
  ArkOnchainBalance,
  ArkPendingBoard,
  ArkServerInfo
} from '@/types/models/Ark'
import {
  getArkAutoBoardStatus,
  getArkMinBoardAmount,
  type ArkAutoBoardStatus
} from '@/utils/arkBoard'
import { ArkOperationBusyError } from '@/utils/arkError'
import { syncArkAccountAndInvalidate } from '@/utils/arkSync'

import { useArkBalance } from './useArkBalance'
import { useArkWallet } from './useArkWallet'

const ONCHAIN_BALANCE_REFETCH_INTERVAL_MS = 15_000

// Boards and sweeps both spend the hidden on-chain wallet, so they share a
// key prefix to let each one see when the other is in flight.
export function arkOnchainSpendMutationKey(
  accountId: string | null | undefined
) {
  return ['ark', 'onchain-spend', accountId]
}

export function useArkOnchainSpendInFlight(
  accountId: string | null | undefined
): boolean {
  return (
    useIsMutating({ mutationKey: arkOnchainSpendMutationKey(accountId) }) > 0
  )
}

export function invalidateArkBoardQueries(
  queryClient: QueryClient,
  accountId: string
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['ark', 'balance', accountId]
    }),
    queryClient.invalidateQueries({
      queryKey: ['ark', 'movements', accountId]
    }),
    queryClient.invalidateQueries({
      queryKey: ['ark', 'onchain-balance', accountId]
    }),
    queryClient.invalidateQueries({
      queryKey: ['ark', 'pending-boards', accountId]
    }),
    queryClient.invalidateQueries({
      queryKey: ['ark', 'vtxos', accountId]
    })
  ]).then(() => undefined)
}

export function useArkOnchainBalance(
  accountId: string | null | undefined,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const { data: walletReady } = useArkWallet(accountId)
  const updateOnchainBalance = useArkStore(
    (state) => state.updateOnchainBalance
  )
  return useQuery<ArkOnchainBalance, Error>({
    enabled: Boolean(enabled && walletReady && accountId),
    queryFn: async () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      const balance = await fetchArkOnchainBalance(account.serverId, accountId)
      updateOnchainBalance(accountId, balance)
      return balance
    },
    queryKey: ['ark', 'onchain-balance', accountId],
    refetchInterval: ONCHAIN_BALANCE_REFETCH_INTERVAL_MS
  })
}

export function useArkOnchainAddress(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery<string, Error>({
    enabled: Boolean(walletReady && accountId),
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return newArkOnchainAddress(account.serverId, accountId)
    },
    queryKey: ['ark', 'onchain-address', accountId],
    staleTime: Infinity
  })
}

/**
 * Board funding destination for externally funded boards (payjoin receive).
 * The address is only spendable through the boardPsbt cosign path, so callers
 * must never expose it as a plain scannable address — see useArkBoardPayjoin.
 */
export function useArkBoardFundingInfo(
  accountId: string | null | undefined,
  enabled: boolean
) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery<ArkBoardFundingInfo, Error>({
    enabled: Boolean(walletReady && accountId) && enabled,
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return getArkBoardFundingAddress(account.serverId, accountId)
    },
    queryKey: ['ark', 'board-funding-address', accountId],
    staleTime: Infinity
  })
}

export function useArkPendingBoards(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery<ArkPendingBoard[], Error>({
    enabled: Boolean(walletReady && accountId),
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return listArkPendingBoards(account.serverId, accountId)
    },
    queryKey: ['ark', 'pending-boards', accountId],
    refetchInterval: ONCHAIN_BALANCE_REFETCH_INTERVAL_MS
  })
}

export function useArkServerInfo(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery<ArkServerInfo | null, Error>({
    enabled: Boolean(walletReady && accountId),
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return fetchArkServerInfo(account.serverId, accountId)
    },
    queryKey: ['ark', 'server-info', accountId],
    staleTime: Infinity
  })
}

export type ArkBoardInput = {
  amountSats?: number
}

export function useArkBoardMutation(accountId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation<ArkPendingBoard, Error, ArkBoardInput>({
    mutationFn: ({ amountSats }) => {
      if (!accountId) {
        throw new Error('Ark account is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return withArkOnchainSpendLock(accountId, () =>
        boardArk(account.serverId, accountId, amountSats)
      )
    },
    mutationKey: [...arkOnchainSpendMutationKey(accountId), 'board'],
    onSuccess: () => {
      if (!accountId) {
        return
      }
      invalidateArkBoardQueries(queryClient, accountId)
      syncArkAccountAndInvalidate(queryClient, accountId)
    }
  })
}

export type ArkAutoBoard = {
  status: ArkAutoBoardStatus
  confirmedSats: number
  pendingSats: number
  minAmountSats: number | undefined
  error: Error | null
  retry: () => void
}

type UseArkAutoBoardArgs = {
  accountId: string | null | undefined
  enabled: boolean
  onBoarded?: () => void
}

export function useArkAutoBoard({
  accountId,
  enabled,
  onBoarded
}: UseArkAutoBoardArgs): ArkAutoBoard {
  const balanceQuery = useArkOnchainBalance(accountId)
  const serverInfoQuery = useArkServerInfo(accountId)
  const boardMutation = useArkBoardMutation(accountId)
  const arkBalanceQuery = useArkBalance(accountId, {
    refetchIntervalMs: ONCHAIN_BALANCE_REFETCH_INTERVAL_MS
  })
  // Several screens of one Ark account can mount this hook at once, and a
  // sweep spends the same wallet, so only fire when nothing else is spending.
  const spendInFlight = useArkOnchainSpendInFlight(accountId)
  // Exits pay their CPFP fees from the on-chain wallet, so never board while
  // one is in progress, nor before the balance says whether one is. The
  // balance polls with the on-chain one so a finished exit stops blocking.
  const exitClear = arkBalanceQuery.data?.pendingExitSats === 0
  const hasFiredRef = useRef(false)

  const confirmedSats = balanceQuery.data?.confirmedSats ?? 0
  const pendingSats = balanceQuery.data?.pendingSats ?? 0
  const minBoardAmountSats = serverInfoQuery.data?.minBoardAmountSats
  const minAmountSats = getArkMinBoardAmount(minBoardAmountSats)

  const status = getArkAutoBoardStatus({
    // A board refused because another screen is already boarding is not a
    // failure: that other board is the one that counts.
    boardFailed:
      boardMutation.isError &&
      !(boardMutation.error instanceof ArkOperationBusyError),
    confirmedSats,
    isBoarding: boardMutation.isPending,
    minBoardAmountSats,
    pendingSats
  })

  useEffect(() => {
    const belowMinimum =
      minAmountSats !== undefined && confirmedSats < minAmountSats
    if (belowMinimum) {
      hasFiredRef.current = false
      if (boardMutation.isSuccess) {
        boardMutation.reset()
      }
    }
    const shouldBoard =
      enabled &&
      exitClear &&
      status === 'readyToBoard' &&
      boardMutation.isIdle &&
      !spendInFlight &&
      !hasFiredRef.current
    if (!shouldBoard) {
      return
    }
    hasFiredRef.current = true
    boardMutation.mutate(
      { amountSats: undefined },
      { onSuccess: () => onBoarded?.() }
    )
  }, [
    enabled,
    status,
    confirmedSats,
    minAmountSats,
    boardMutation,
    exitClear,
    spendInFlight,
    onBoarded
  ])

  function retry() {
    hasFiredRef.current = false
    boardMutation.reset()
  }

  return {
    confirmedSats,
    error: boardMutation.error,
    minAmountSats,
    pendingSats,
    retry,
    status
  }
}
