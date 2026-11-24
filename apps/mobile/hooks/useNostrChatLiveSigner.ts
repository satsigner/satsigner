import { toast } from 'sonner-native'

import {
  approveNip46Request,
  rejectNip46Request
} from '@/hooks/useNip46SessionManager'
import type { Nip46AnswerResult } from '@/hooks/useNip46SessionManager'
import { t } from '@/locales'
import { useNip46Store } from '@/store/nip46'
import type { Nip46Session } from '@/types/models/Nostr'

function announce(result: Nip46AnswerResult, sentMessage: string) {
  if (result === 'sent') {
    toast.success(sentMessage)
  }
  if (result === 'failed') {
    toast.error(t('nip46.responseFailed'))
  }
}

function isLentToSession(
  session: Nip46Session,
  identityNpub: string,
  peerPubkey: string,
  sessionId: string
): boolean {
  return (
    session.signerNpub === identityNpub &&
    session.origin?.kind === 'chat' &&
    session.origin.peerPubkey === peerPubkey &&
    session.origin.sessionId === sessionId
  )
}

/**
 * Live NIP-46 requests from a signer lent in this chat session, so they can
 * be approved without leaving the thread.
 */
export function useNostrChatLiveSigner(
  identityNpub: string,
  peerPubkey: string,
  sessionId: string
) {
  const sessions = useNip46Store((state) => state.sessions)
  const pendingRequests = useNip46Store((state) => state.pendingRequests)
  const lentSessionIds = new Set(
    sessions
      .filter((session) =>
        isLentToSession(session, identityNpub, peerPubkey, sessionId)
      )
      .map((session) => session.id)
  )
  const currentRequest =
    pendingRequests.find((request) => lentSessionIds.has(request.sessionId)) ??
    null

  async function approve(requestId: string, alwaysAllow: boolean) {
    announce(
      await approveNip46Request(requestId, alwaysAllow),
      t('nip46.requestApproved')
    )
  }

  async function reject(requestId: string, alwaysReject: boolean) {
    announce(
      await rejectNip46Request(requestId, alwaysReject),
      t('nip46.requestRejected')
    )
  }

  function handleApprove(requestId: string, alwaysAllow: boolean) {
    void approve(requestId, alwaysAllow)
  }

  function handleReject(requestId: string, alwaysReject: boolean) {
    void reject(requestId, alwaysReject)
  }

  return {
    currentRequest,
    handleApprove,
    handleReject,
    lentCount: lentSessionIds.size
  }
}
