import {
  NOSTR_SIGN_REQUEST_RETENTION_SECS,
  NOSTR_SIGN_REQUESTS_PENDING_MAX
} from '@/constants/nostr'
import { hasOutgoingChatSessionMessage } from '@/db/queries/nostrChat'
import {
  countPendingSignRequests,
  expireSignRequests,
  insertSignRequests,
  pruneSignRequests
} from '@/db/signRequests'
import { parseSignRequests } from '@/utils/signingQueue'
import type { SignRequestContext } from '@/utils/signingQueue'

/**
 * Queues the signature requests a peer's message carries. Only a peer we
 * wrote to in this very session may ask: a stranger's request is left as
 * plain text. Requests past the pending cap are dropped, not queued.
 * Returns how many were queued.
 */
function queueChatSignRequests(
  content: string,
  tags: unknown,
  context: SignRequestContext
): number {
  if (
    !hasOutgoingChatSessionMessage(
      context.identityNpub,
      context.peerPubkey,
      context.sessionId
    )
  ) {
    return 0
  }
  const requests = parseSignRequests(content, tags, context)
  const room =
    NOSTR_SIGN_REQUESTS_PENDING_MAX -
    countPendingSignRequests(context.identityNpub, context.peerPubkey)
  if (requests.length === 0 || requests.length > room) {
    return 0
  }
  return insertSignRequests(requests)
}

/** Expires what timed out and forgets what settled long ago. */
function settleChatSignRequests(identityNpub: string, nowSeconds: number) {
  expireSignRequests(identityNpub, nowSeconds)
  pruneSignRequests(
    identityNpub,
    nowSeconds - NOSTR_SIGN_REQUEST_RETENTION_SECS
  )
}

export { queueChatSignRequests, settleChatSignRequests }
