import { t } from '@/locales'
import type { NostrErrorCode } from '@/types/models/Nostr'
import {
  NostrNoRelaysError,
  NostrPartialSendError,
  NostrPublishError,
  NostrRelayTimeoutError
} from '@/utils/errors'

function getNostrErrorCode(error: unknown): NostrErrorCode {
  if (error instanceof NostrNoRelaysError) {
    return 'noRelays'
  }
  if (error instanceof NostrRelayTimeoutError) {
    return 'timeout'
  }
  if (error instanceof NostrPublishError) {
    return 'publishFailed'
  }
  if (error instanceof NostrPartialSendError) {
    return 'partialSend'
  }
  return 'unknown'
}

function getNostrErrorMessageForCode(code: NostrErrorCode): string {
  return t(`nostrErrors.${code}`)
}

/** User-facing, translated message for any error thrown by the nostr layer. */
function getNostrErrorMessage(error: unknown): string {
  if (error instanceof NostrPartialSendError) {
    return t('nostrErrors.partialSend', {
      delivered: error.delivered.length,
      total: error.delivered.length + error.failed.length
    })
  }
  return getNostrErrorMessageForCode(getNostrErrorCode(error))
}

export { getNostrErrorCode, getNostrErrorMessage, getNostrErrorMessageForCode }
