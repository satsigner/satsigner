import type { NostrAPI } from '@/api/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import {
  decideSignRequestBatch,
  listSignRequestBatch,
  markSignRequestBatchAnswered
} from '@/db/signRequests'
import type { SignRequestDecision } from '@/db/signRequests'
import type { NostrSignRequest } from '@/types/models/Nostr'
import {
  getPubKeyHexFromNpub,
  getSecretFromNsec,
  safeNpubEncode
} from '@/utils/nostr'
import { invalidateChatQueries, sendNip17Chat } from '@/utils/nostrChat'
import type { ChatIdentity } from '@/utils/nostrChat'
import {
  approveSignRequestBatch,
  buildSignResponse,
  rejectSignRequestBatch
} from '@/utils/signingQueue'

type SignAnswerOutcome = 'answered' | 'not_sent' | 'skipped'

const SKIPPED: Promise<SignAnswerOutcome> = Promise.resolve('skipped')

function nowSeconds(): number {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function toStoredDecision(request: NostrSignRequest): SignRequestDecision {
  return {
    error: request.error,
    requestId: request.requestId,
    result: request.result,
    status: request.status
  }
}

/**
 * Sends the stored decision of a batch back in its session, as a reply to
 * the request. The decision is stored first, so a send that fails is resent
 * from storage and nothing is signed twice.
 */
async function sendSignAnswer(
  api: NostrAPI,
  identity: ChatIdentity,
  batch: NostrSignRequest[]
): Promise<SignAnswerOutcome> {
  const [first] = batch
  if (!first) {
    return 'skipped'
  }
  const { content, tags } = buildSignResponse(batch.map(toStoredDecision))
  const sent = await sendNip17Chat(
    api,
    identity,
    safeNpubEncode(first.peerPubkey),
    content,
    { extraTags: tags, replyToId: first.messageId, sessionId: first.sessionId }
  ).then(
    () => true,
    () => false
  )
  if (!sent) {
    invalidateChatQueries(identity.npub)
    return 'not_sent'
  }
  markSignRequestBatchAnswered(identity.npub, first.messageId)
  invalidateChatQueries(identity.npub)
  return 'answered'
}

function isUndecided(batch: NostrSignRequest[]): boolean {
  return !batch.some(
    (request) => request.status === 'signed' || request.status === 'rejected'
  )
}

/**
 * Signs every request of a batch with the chat identity, never any other
 * key, stores the result, then answers. A batch that is no longer pending
 * (decided on another screen, expired) is left alone.
 */
function approveChatSignRequests(
  api: NostrAPI,
  identity: ChatIdentity,
  messageId: string
): Promise<SignAnswerOutcome> {
  const batch = listSignRequestBatch(identity.npub, messageId)
  const ownHex = getPubKeyHexFromNpub(identity.npub)
  const signable = batch.some((request) => request.status === 'pending')
  if (!signable || !isUndecided(batch) || ownHex === null) {
    return SKIPPED
  }
  const secretKey = getSecretFromNsec(identity.nsec)
  if (!secretKey) {
    return SKIPPED
  }
  const decisions = approveSignRequestBatch(
    batch,
    ownHex,
    secretKey,
    nowSeconds()
  )
  secretKey.fill(0)
  if (!decideSignRequestBatch(identity.npub, messageId, decisions)) {
    return SKIPPED
  }
  return sendSignAnswer(
    api,
    identity,
    listSignRequestBatch(identity.npub, messageId)
  )
}

function rejectChatSignRequests(
  api: NostrAPI,
  identity: ChatIdentity,
  messageId: string
): Promise<SignAnswerOutcome> {
  const batch = listSignRequestBatch(identity.npub, messageId)
  if (
    batch.length === 0 ||
    !decideSignRequestBatch(
      identity.npub,
      messageId,
      rejectSignRequestBatch(batch)
    )
  ) {
    return SKIPPED
  }
  return sendSignAnswer(
    api,
    identity,
    listSignRequestBatch(identity.npub, messageId)
  )
}

/** A batch decided earlier whose answer never reached a relay. */
function resendChatSignAnswer(
  api: NostrAPI,
  identity: ChatIdentity,
  messageId: string
): Promise<SignAnswerOutcome> {
  const batch = listSignRequestBatch(identity.npub, messageId)
  if (batch.length === 0 || isUndecided(batch) || batch[0]?.answered) {
    return SKIPPED
  }
  return sendSignAnswer(api, identity, batch)
}

export { approveChatSignRequests, rejectChatSignRequests, resendChatSignAnswer }
export type { SignAnswerOutcome }
