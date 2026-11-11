import {
  EXPLORER_REQUEST_TIMEOUT_MS,
  EXPLORER_REQUEST_TOR_TIMEOUT_MS
} from '@/constants/explorer'
import { isOnionUrl } from '@/utils/serverPrivacy'
import { withTimeout } from '@/utils/time'

export function withExplorerTimeout<T>(promise: Promise<T>, url: string) {
  const ms = isOnionUrl(url)
    ? EXPLORER_REQUEST_TOR_TIMEOUT_MS
    : EXPLORER_REQUEST_TIMEOUT_MS
  return withTimeout(promise, ms, 'timeout')
}
