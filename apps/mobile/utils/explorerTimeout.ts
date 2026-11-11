import {
  EXPLORER_QUERY_RETRY,
  EXPLORER_REQUEST_TIMEOUT_MS,
  EXPLORER_REQUEST_TOR_TIMEOUT_MS
} from '@/constants/explorer'
import { isOnionUrl } from '@/utils/serverPrivacy'
import { withTimeout } from '@/utils/time'

const EXPLORER_TIMEOUT_MESSAGE = 'timeout'

export function withExplorerTimeout<T>(promise: Promise<T>, url: string) {
  const ms = isOnionUrl(url)
    ? EXPLORER_REQUEST_TOR_TIMEOUT_MS
    : EXPLORER_REQUEST_TIMEOUT_MS
  return withTimeout(promise, ms, EXPLORER_TIMEOUT_MESSAGE)
}

/**
 * Retries a failed explorer query once, but not one that already waited the
 * whole timeout: that would only double the wait before the error shows.
 */
export function retryExplorerQuery(failureCount: number, error: unknown) {
  const timedOut =
    error instanceof Error && error.message === EXPLORER_TIMEOUT_MESSAGE
  return !timedOut && failureCount < EXPLORER_QUERY_RETRY
}
