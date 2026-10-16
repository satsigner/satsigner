import {
  type QueryState,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import {
  ECASH_QUOTE_POLL_INTERVAL_MS,
  ECASH_QUOTE_POLL_MAX_ATTEMPTS
} from '@/constants/ecash'
import type { MintQuoteState } from '@/types/models/Ecash'

type MintQuoteCheckParams = {
  mintUrl: string
  quoteId: string
  checkMintQuote: (mintUrl: string, quoteId: string) => Promise<MintQuoteState>
  /** Runs once the quote is paid; mint the proofs here. */
  onPaid: () => Promise<void>
  /** Runs once the quote expired or was cancelled. */
  onFailed: () => void
}

type MintQuotePollingParams = Omit<
  MintQuoteCheckParams,
  'mintUrl' | 'quoteId'
> & {
  enabled: boolean
  mintUrl: string | undefined
  quoteId: string | undefined
}

const PAID_STATES = new Set<MintQuoteState>(['PAID', 'ISSUED'])
const FAILED_STATES = new Set<MintQuoteState>(['EXPIRED', 'CANCELLED'])
// Quotes whose proofs are being minted right now, so a concurrent check of the
// same quote cannot claim them twice.
const claimingQuoteIds = new Set<string>()

export function shouldKeepPolling(state: QueryState<MintQuoteState>) {
  const settled =
    state.data !== undefined &&
    (PAID_STATES.has(state.data) || FAILED_STATES.has(state.data))
  const attempts = state.dataUpdateCount + state.errorUpdateCount
  return !settled && attempts < ECASH_QUOTE_POLL_MAX_ATTEMPTS
}

/**
 * Checks a mint quote once and runs `onPaid` / `onFailed` for a final state.
 * `onPaid` never runs twice at the same time for one quote; the skipped
 * check returns PENDING.
 */
export async function checkMintQuoteOnce({
  mintUrl,
  quoteId,
  checkMintQuote,
  onPaid,
  onFailed
}: MintQuoteCheckParams) {
  const state = await checkMintQuote(mintUrl, quoteId)
  if (FAILED_STATES.has(state)) {
    onFailed()
    return state
  }
  if (!PAID_STATES.has(state)) {
    return state
  }
  // Another check is claiming this quote; report it as unsettled so polling
  // goes on if that claim fails.
  if (claimingQuoteIds.has(quoteId)) {
    return 'PENDING'
  }
  claimingQuoteIds.add(quoteId)
  try {
    await onPaid()
  } finally {
    claimingQuoteIds.delete(quoteId)
  }
  return state
}

/**
 * Polls a mint quote until it is paid, fails, or the attempt budget runs out,
 * and hands the outcome to `onPaid` / `onFailed`. The query function mints
 * proofs, so never invalidate or refetch this query from outside.
 */
export function useEcashMintQuotePolling({
  enabled,
  mintUrl,
  quoteId,
  checkMintQuote,
  onPaid,
  onFailed
}: MintQuotePollingParams) {
  const isEnabled = enabled && Boolean(mintUrl && quoteId)
  const queryClient = useQueryClient()
  const queryKey = ['ecash', 'mint-quote', mintUrl, quoteId]
  useQuery({
    enabled: isEnabled,
    // isPolling reads the attempt count from the cache; re-render per attempt.
    notifyOnChangeProps: ['data', 'dataUpdatedAt', 'errorUpdatedAt'],
    queryFn: () =>
      checkMintQuoteOnce({
        checkMintQuote,
        mintUrl: mintUrl ?? '',
        onFailed,
        onPaid,
        quoteId: quoteId ?? ''
      }),
    queryKey,
    refetchInterval: ({ state }) =>
      shouldKeepPolling(state) ? ECASH_QUOTE_POLL_INTERVAL_MS : false,
    retry: false
  })

  const state = queryClient.getQueryState<MintQuoteState>(queryKey)
  return { isPolling: isEnabled && (!state || shouldKeepPolling(state)) }
}
