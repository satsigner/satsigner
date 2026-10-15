import { type QueryState, useQuery } from '@tanstack/react-query'

import {
  ECASH_QUOTE_POLL_INTERVAL_MS,
  ECASH_QUOTE_POLL_MAX_ATTEMPTS
} from '@/constants/ecash'
import type { MintQuoteState } from '@/types/models/Ecash'

type MintQuotePollingParams = {
  enabled: boolean
  mintUrl: string | undefined
  quoteId: string | undefined
  checkMintQuote: (mintUrl: string, quoteId: string) => Promise<MintQuoteState>
  /** Runs once the quote is paid; mint the proofs here. */
  onPaid: () => Promise<void>
  /** Runs once the quote expired or was cancelled. */
  onFailed: () => void
}

const PAID_STATES = new Set<MintQuoteState>(['PAID', 'ISSUED'])
const FAILED_STATES = new Set<MintQuoteState>(['EXPIRED', 'CANCELLED'])

export function shouldKeepPolling(state: QueryState<MintQuoteState>) {
  const settled =
    state.data !== undefined &&
    (PAID_STATES.has(state.data) || FAILED_STATES.has(state.data))
  const attempts = state.dataUpdateCount + state.errorUpdateCount
  return !settled && attempts < ECASH_QUOTE_POLL_MAX_ATTEMPTS
}

/**
 * Polls a mint quote until it is paid, fails, or the attempt budget runs out,
 * and hands the outcome to `onPaid` / `onFailed`.
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
  const query = useQuery({
    enabled: isEnabled,
    queryFn: async () => {
      const state = await checkMintQuote(mintUrl ?? '', quoteId ?? '')
      if (PAID_STATES.has(state)) {
        await onPaid()
      }
      if (FAILED_STATES.has(state)) {
        onFailed()
      }
      return state
    },
    queryKey: ['ecash', 'mint-quote', mintUrl, quoteId],
    refetchInterval: ({ state }) =>
      shouldKeepPolling(state) ? ECASH_QUOTE_POLL_INTERVAL_MS : false,
    retry: false
  })

  const settled =
    query.data !== undefined &&
    (PAID_STATES.has(query.data) || FAILED_STATES.has(query.data))
  return { isPolling: isEnabled && !settled }
}
