import {
  type NotifyOnChangeProps,
  type QueryState,
  skipToken,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import {
  ECASH_MINT_QUOTE_FAILED_STATES,
  ECASH_MINT_QUOTE_PAID_STATES,
  ECASH_QUOTE_POLL_INTERVAL_MS,
  ECASH_QUOTE_MAX_POLL_ATTEMPTS
} from '@/constants/ecash'
import type { MintQuoteState } from '@/types/models/Ecash'

type MintQuoteCheckParams = {
  mintUrl: string
  quoteId: string
  checkMintQuote: (mintUrl: string, quoteId: string) => Promise<MintQuoteState>
  onQuotePaid: () => Promise<void>
  onQuoteExpiredOrCancelled: () => void
}

type MintQuotePollingParams = Omit<
  MintQuoteCheckParams,
  'mintUrl' | 'quoteId'
> & {
  enabled: boolean
  mintUrl: string | undefined
  quoteId: string | undefined
}

const RERENDER_ON_EVERY_POLL_ATTEMPT: NotifyOnChangeProps = [
  'data',
  'dataUpdatedAt',
  'errorUpdatedAt'
]

const quoteIdsBeingClaimed = new Set<string>()

export function shouldKeepPolling(state: QueryState<MintQuoteState>) {
  const settled =
    state.data !== undefined &&
    (ECASH_MINT_QUOTE_PAID_STATES.has(state.data) ||
      ECASH_MINT_QUOTE_FAILED_STATES.has(state.data))
  const attempts = state.dataUpdateCount + state.errorUpdateCount
  return !settled && attempts < ECASH_QUOTE_MAX_POLL_ATTEMPTS
}

/**
 * Checks a mint quote once and runs `onQuotePaid` /
 * `onQuoteExpiredOrCancelled` for a final state. `onQuotePaid` never runs
 * twice at the same time for one quote; the skipped check returns PENDING.
 */
export async function checkMintQuoteOnce({
  mintUrl,
  quoteId,
  checkMintQuote,
  onQuotePaid,
  onQuoteExpiredOrCancelled
}: MintQuoteCheckParams) {
  const state = await checkMintQuote(mintUrl, quoteId)
  if (ECASH_MINT_QUOTE_FAILED_STATES.has(state)) {
    onQuoteExpiredOrCancelled()
    return state
  }
  if (!ECASH_MINT_QUOTE_PAID_STATES.has(state)) {
    return state
  }
  const isClaimedByConcurrentCheck = quoteIdsBeingClaimed.has(quoteId)
  if (isClaimedByConcurrentCheck) {
    return 'PENDING'
  }
  quoteIdsBeingClaimed.add(quoteId)
  try {
    await onQuotePaid()
  } finally {
    quoteIdsBeingClaimed.delete(quoteId)
  }
  return state
}

/**
 * Polls a mint quote until it is paid, fails, or the attempt budget runs out,
 * and hands the outcome to `onQuotePaid` / `onQuoteExpiredOrCancelled`. The
 * query function mints proofs, so never invalidate or refetch this query from
 * outside.
 */
export function useEcashMintQuotePolling({
  enabled,
  mintUrl,
  quoteId,
  checkMintQuote,
  onQuotePaid,
  onQuoteExpiredOrCancelled
}: MintQuotePollingParams) {
  const isEnabled = enabled && !!mintUrl && !!quoteId
  const queryClient = useQueryClient()
  const queryKey = ['ecash', 'mint-quote', mintUrl, quoteId]
  useQuery({
    notifyOnChangeProps: RERENDER_ON_EVERY_POLL_ATTEMPT,
    queryFn: isEnabled
      ? () =>
          checkMintQuoteOnce({
            checkMintQuote,
            mintUrl,
            onQuoteExpiredOrCancelled,
            onQuotePaid,
            quoteId
          })
      : skipToken,
    queryKey,
    refetchInterval: ({ state }) =>
      shouldKeepPolling(state) ? ECASH_QUOTE_POLL_INTERVAL_MS : false,
    retry: false
  })

  const state = queryClient.getQueryState<MintQuoteState>(queryKey)
  return { isPolling: isEnabled && (!state || shouldKeepPolling(state)) }
}
