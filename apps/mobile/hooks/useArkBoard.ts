import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import {
  boardArk,
  estimateArkBoardFee,
  fetchArkOnchainBalance,
  fetchArkServerInfo,
  listArkPendingBoards,
  newArkOnchainAddress
} from '@/api/ark'
import type {
  ArkFeeEstimate,
  ArkOnchainBalance,
  ArkPendingBoard,
  ArkServerInfo
} from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'
import {
  getArkAutoBoardStatus,
  getArkMinBoardAmount,
  type ArkAutoBoardStatus
} from '@/utils/arkBoard'
import { syncArkAccountAndInvalidate } from '@/utils/arkSync'

import { useArkWallet } from './useArkWallet'

const ONCHAIN_BALANCE_REFETCH_INTERVAL_MS = 15_000
const FEE_ESTIMATE_STALE_TIME_MS = 30_000

function invalidateArkBoardQueries(
  queryClient: QueryClient,
  accountId: string
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['ark', 'onchain-balance', accountId]
    }),
    queryClient.invalidateQueries({
      queryKey: ['ark', 'pending-boards', accountId]
    })
  ]).then(() => undefined)
}

export function useArkOnchainBalance(accountId: string | null | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery<ArkOnchainBalance, Error>({
    enabled: Boolean(walletReady && accountId),
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return fetchArkOnchainBalance(account.serverId, accountId)
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

type UseArkBoardFeeEstimateArgs = {
  accountId: string | null | undefined
  amountSats: number
  enabled: boolean
}

export function useArkBoardFeeEstimate({
  accountId,
  amountSats,
  enabled
}: UseArkBoardFeeEstimateArgs) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery<ArkFeeEstimate, Error>({
    enabled: Boolean(walletReady && accountId) && enabled && amountSats > 0,
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      return estimateArkBoardFee(account.serverId, accountId, amountSats)
    },
    queryKey: ['ark', 'board-fee-estimate', accountId, amountSats],
    retry: false,
    staleTime: FEE_ESTIMATE_STALE_TIME_MS
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
      return boardArk(account.serverId, accountId, amountSats)
    },
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
  const hasFiredRef = useRef(false)

  const confirmedSats = balanceQuery.data?.confirmedSats ?? 0
  const pendingSats = balanceQuery.data?.pendingSats ?? 0
  const minBoardAmountSats = serverInfoQuery.data?.minBoardAmountSats
  const minAmountSats = getArkMinBoardAmount(minBoardAmountSats)

  const status = getArkAutoBoardStatus({
    boardFailed: boardMutation.isError,
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
      status === 'readyToBoard' &&
      boardMutation.isIdle &&
      !hasFiredRef.current
    if (!shouldBoard) {
      return
    }
    hasFiredRef.current = true
    boardMutation.mutate(
      { amountSats: undefined },
      { onSuccess: () => onBoarded?.() }
    )
  }, [enabled, status, confirmedSats, minAmountSats, boardMutation, onBoarded])

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
