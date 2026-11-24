import { useState } from 'react'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { t } from '@/locales'
import {
  approveChatSignRequests,
  rejectChatSignRequests,
  resendChatSignAnswer
} from '@/utils/chatSignAnswers'
import type { SignAnswerOutcome } from '@/utils/chatSignAnswers'
import { getChatPipelineApi } from '@/utils/nostrChat'
import { getNostrContactsRelays } from '@/utils/nostrContacts'
import { isNonEmptyString } from '@/utils/string'

type SigningIdentity = {
  npub: string
  nsec?: string
  relays?: string[]
}

type SignAnswer = typeof approveChatSignRequests

function announce(outcome: SignAnswerOutcome, success: string) {
  if (outcome === 'answered') {
    toast.success(success)
    return
  }
  if (outcome === 'not_sent') {
    toast.error(t('nip46.chat.notSent'))
  }
}

/**
 * Approve, reject or resend a batch of signature requests in the thread.
 * Only the thread's own identity signs; without its nsec nothing is offered.
 */
export function useNostrChatSignRequests(
  identity: SigningIdentity | undefined
) {
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null)
  const nsec = identity?.nsec
  const canSign = isNonEmptyString(nsec)

  async function run(messageId: string, answer: SignAnswer, success: string) {
    if (!identity || !isNonEmptyString(nsec) || busyMessageId !== null) {
      return
    }
    setBusyMessageId(messageId)
    const pipelineApi = getChatPipelineApi(identity.npub)
    const api =
      pipelineApi ?? new NostrAPI(getNostrContactsRelays(identity.relays))
    const outcome = await answer(
      api,
      { npub: identity.npub, nsec, relays: identity.relays },
      messageId
    ).catch((): SignAnswerOutcome => 'not_sent')
    if (!pipelineApi) {
      api.closeAllSubscriptions()
    }
    setBusyMessageId(null)
    announce(outcome, success)
  }

  function approve(messageId: string) {
    void run(messageId, approveChatSignRequests, t('nip46.chat.signed'))
  }

  function reject(messageId: string) {
    void run(messageId, rejectChatSignRequests, t('nip46.chat.rejected'))
  }

  function resend(messageId: string) {
    void run(messageId, resendChatSignAnswer, t('nip46.chat.resent'))
  }

  return { approve, busyMessageId, canSign, reject, resend }
}
