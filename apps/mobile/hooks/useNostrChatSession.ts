import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'

import { NostrAPI } from '@/api/nostr'
import {
  getChatSession,
  listArchivedChatSessions
} from '@/db/queries/nostrChat'
import { t } from '@/locales'
import type { NostrChatProtocol, NostrChatSession } from '@/types/models/Nostr'
import {
  deleteChatSessionForEveryone,
  getChatPipelineApi,
  invalidateChatQueries,
  nostrChatQueryKeys
} from '@/utils/nostrChat'
import type { ChatIdentity } from '@/utils/nostrChat'
import {
  archiveChatSession,
  forgetChatSession,
  isDefaultChatSession,
  renameChatSessionTitle,
  startChatSession
} from '@/utils/nostrChatSessions'
import { getNostrContactsRelays } from '@/utils/nostrContacts'
import { nostrChatThreadHref } from '@/utils/nostrNavigation'
import { isNonEmptyString } from '@/utils/string'

const NO_SESSIONS: NostrChatSession[] = []

type SessionIdentity = Pick<ChatIdentity, 'npub' | 'relays'> & {
  nsec?: string
}

type ChatSessionTarget = {
  identity: SessionIdentity | undefined
  peerNpub: string
  peerPubkey: string | null
  protocol: NostrChatProtocol
  sessionId: string
}

async function deleteOwnMessagesEverywhere(
  identity: ChatIdentity,
  peerNpub: string,
  sessionId: string
): Promise<void> {
  const pipelineApi = getChatPipelineApi(identity.npub)
  const api =
    pipelineApi ?? new NostrAPI(getNostrContactsRelays(identity.relays))
  try {
    await deleteChatSessionForEveryone(api, identity, peerNpub, sessionId)
  } finally {
    if (!pipelineApi) {
      api.closeAllSubscriptions()
    }
  }
}

/** Title, rename, archive, delete and "new session" for one chat thread. */
export function useNostrChatSession({
  identity,
  peerNpub,
  peerPubkey,
  protocol,
  sessionId
}: ChatSessionTarget) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const identityNpub = identity?.npub ?? ''
  const key = {
    identityNpub,
    peerPubkey: peerPubkey ?? '',
    sessionId
  }

  const { data: session } = useQuery({
    enabled: isNonEmptyString(identityNpub) && peerPubkey !== null,
    queryFn: () => getChatSession(key.identityNpub, key.peerPubkey, sessionId),
    queryKey: nostrChatQueryKeys.session(
      key.identityNpub,
      key.peerPubkey,
      sessionId
    )
  })

  const { data: archivedSessions = NO_SESSIONS } = useQuery({
    enabled: isNonEmptyString(identityNpub) && peerPubkey !== null,
    queryFn: () => listArchivedChatSessions(key.identityNpub, key.peerPubkey),
    queryKey: nostrChatQueryKeys.archivedSessions(
      key.identityNpub,
      key.peerPubkey
    )
  })

  const canManage = protocol === 'nip17' && peerPubkey !== null
  const nsec = identity?.nsec
  const canDeleteEverywhere = isNonEmptyString(nsec)

  function startNew(title?: string) {
    if (!canManage || !isNonEmptyString(identityNpub)) {
      return
    }
    const created = startChatSession(identityNpub, key.peerPubkey, title)
    invalidateChatQueries(identityNpub)
    router.push(
      nostrChatThreadHref(identityNpub, peerNpub, protocol, {
        sessionId: created.sessionId
      })
    )
  }

  function rename(title: string) {
    if (!canManage) {
      return
    }
    renameChatSessionTitle(key, title)
    invalidateChatQueries(identityNpub)
  }

  function archive() {
    if (!canManage) {
      return
    }
    archiveChatSession(key, true)
    invalidateChatQueries(identityNpub)
    router.back()
  }

  /** Brings an archived session back to the list and opens it. */
  function restore(archivedId: string) {
    if (!canManage) {
      return
    }
    archiveChatSession({ ...key, sessionId: archivedId }, false)
    invalidateChatQueries(identityNpub)
    router.push(
      nostrChatThreadHref(identityNpub, peerNpub, protocol, {
        sessionId: archivedId
      })
    )
  }

  /**
   * Removes the session here; with `everywhere`, first asks the peer and
   * relays to drop the messages we sent in it. A failed request, or no key
   * to sign it with, keeps the session, so nothing is lost silently.
   */
  async function deleteSession(everywhere: boolean) {
    if (!canManage || deleting) {
      return
    }
    if (everywhere && (!identity || !isNonEmptyString(nsec))) {
      throw new Error(t('nostrIdentity.chat.sessions.deleteNeedsKey'))
    }
    setDeleting(true)
    const remote =
      everywhere && identity && isNonEmptyString(nsec)
        ? deleteOwnMessagesEverywhere(
            { npub: identity.npub, nsec, relays: identity.relays },
            peerNpub,
            sessionId
          )
        : Promise.resolve()
    const failure = await remote.then(
      () => null,
      (error: unknown) => ({ error })
    )
    setDeleting(false)
    if (failure) {
      invalidateChatQueries(identityNpub)
      throw failure.error
    }
    forgetChatSession(key)
    invalidateChatQueries(identityNpub)
    router.back()
  }

  return {
    archive,
    archivedSessions,
    canDeleteEverywhere,
    canManage,
    deleteSession,
    deleting,
    isDefault: isDefaultChatSession(sessionId),
    rename,
    restore,
    startNew,
    title: session?.title
  }
}
