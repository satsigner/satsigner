import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import {
  ARK_QUERY_STALE_TIME_MS,
  ARK_SWAP_POLL_INTERVAL_MS,
  ARK_SWAP_RUNNER_QUERY_KEY
} from '@/constants/ark'
import {
  advanceArkSwapJobs,
  estimateArkSwapMaxInvoiceSats,
  quoteArkSwap,
  startArkSwap,
  submitArkSwapInvoice
} from '@/services/arkSwap'
import { useArkSwapsStore } from '@/store/arkSwaps'
import { type ArkSwapJob, type ArkSwapRequest } from '@/types/models/ArkSwap'
import { arkBoardIoPreviewHref } from '@/utils/arkBoardDeposit'
import {
  canSubmitArkSwapInvoice,
  isArkSwapJobRunnable,
  isArkSwapJobTerminal
} from '@/utils/arkSwap'
import { syncArkAccountAndInvalidate } from '@/utils/arkSync'

type ArkSwapInvoiceSubmission = {
  jobId: string
  invoice: string
}

export function useArkSwapJobs(arkAccountId: string | undefined) {
  return useArkSwapsStore(
    useShallow((state) =>
      state.jobs.filter((job) => job.arkAccountId === arkAccountId)
    )
  )
}

export function useArkSwapActiveCount(arkAccountId: string | undefined) {
  return useArkSwapsStore(
    (state) =>
      state.jobs.filter(
        (job) => job.arkAccountId === arkAccountId && !isArkSwapJobTerminal(job)
      ).length
  )
}

/**
 * Drives persisted swaps for every Ark account while the app is open, so a
 * swap keeps moving whichever screen the user is on.
 */
export function useArkSwapRunner() {
  const queryClient = useQueryClient()
  const hasRunnableJobs = useArkSwapsStore((state) =>
    state.jobs.some(isArkSwapJobRunnable)
  )
  return useQuery({
    enabled: hasRunnableJobs,
    queryFn: async () => {
      const changedAccountIds = await advanceArkSwapJobs()
      await Promise.all(
        changedAccountIds.map((accountId) =>
          syncArkAccountAndInvalidate(queryClient, accountId)
        )
      )
      return changedAccountIds
    },
    queryKey: ARK_SWAP_RUNNER_QUERY_KEY,
    refetchInterval: ARK_SWAP_POLL_INTERVAL_MS,
    retry: false
  })
}

export function useArkSwapQuote(input: ArkSwapRequest | undefined) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: input ? () => quoteArkSwap(input) : skipToken,
    queryKey: ['ark', 'swapQuote', input],
    retry: false
  })
}

export function useArkSwapStart() {
  const router = useRouter()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startArkSwap,
    onSuccess: (result, { arkAccountId }) => {
      if (
        result.route === 'onchainToArk' ||
        result.route === 'onchainToLightning'
      ) {
        router.navigate(arkBoardIoPreviewHref(result.sourceAccountId))
        return
      }
      void syncArkAccountAndInvalidate(queryClient, arkAccountId)
    }
  })
}

export function useArkSwapInvoiceSubmit(arkAccountId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, invoice }: ArkSwapInvoiceSubmission) =>
      submitArkSwapInvoice(jobId, invoice),
    onSettled: () => {
      if (arkAccountId) {
        void syncArkAccountAndInvalidate(queryClient, arkAccountId)
      }
    }
  })
}

/** Largest invoice each swap waiting for one can pay, looked up by job id. */
export function useArkSwapMaxInvoices(jobs: ArkSwapJob[]) {
  const awaitingInvoice = jobs.filter(canSubmitArkSwapInvoice)
  const results = useQueries({
    queries: awaitingInvoice.map((job) => ({
      queryFn: () =>
        estimateArkSwapMaxInvoiceSats(job.arkAccountId, job.amountSats),
      queryKey: ['ark', 'swapMaxInvoice', job.id, job.amountSats],
      staleTime: ARK_QUERY_STALE_TIME_MS
    }))
  })
  return function getMaxInvoiceSats(jobId: string) {
    const index = awaitingInvoice.findIndex((job) => job.id === jobId)
    if (index === -1) {
      return undefined
    }
    return results[index]?.data
  }
}
