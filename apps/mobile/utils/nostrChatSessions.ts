import { bytesToHex } from '@noble/hashes/utils'
import QuickCrypto from 'react-native-quick-crypto'

import {
  NOSTR_CHAT_DEFAULT_SESSION_ID,
  NOSTR_CHAT_SESSION_ID_BYTES
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import {
  deleteChatSession,
  insertChatSession,
  renameChatSession,
  setChatSessionArchived
} from '@/db/mutations/nostrChat'
import type { ChatSessionKey } from '@/db/mutations/nostrChat'
import { getChatSession } from '@/db/queries/nostrChat'
import { t } from '@/locales'
import { stopNip46Session } from '@/services/nip46Sessions'
import { useNip46Store } from '@/store/nip46'
import type {
  NostrChatConversationItem,
  NostrChatSession
} from '@/types/models/Nostr'
import { normalizeSessionTitle } from '@/utils/nostrChatTags'

function createChatSessionId(): string {
  return bytesToHex(
    Uint8Array.from(QuickCrypto.randomBytes(NOSTR_CHAT_SESSION_ID_BYTES))
  )
}

/**
 * A session exists locally before its first message; nothing is published
 * until the user writes in it. Its first message carries the title.
 */
function startChatSession(
  identityNpub: string,
  peerPubkey: string,
  title?: string
): NostrChatSession {
  const session: NostrChatSession = {
    archived: false,
    createdAt: Math.floor(Date.now() / MS_PER_SECOND),
    identityNpub,
    peerPubkey,
    sessionId: createChatSessionId(),
    title: title === undefined ? undefined : normalizeSessionTitle(title)
  }
  insertChatSession(session)
  return session
}

/** The default session has no row of its own; it gets one when first named. */
function ensureChatSessionRow(session: ChatSessionKey): void {
  if (
    getChatSession(session.identityNpub, session.peerPubkey, session.sessionId)
  ) {
    return
  }
  insertChatSession({
    ...session,
    archived: false,
    createdAt: Math.floor(Date.now() / MS_PER_SECOND)
  })
}

function renameChatSessionTitle(session: ChatSessionKey, title: string): void {
  ensureChatSessionRow(session)
  renameChatSession(session, normalizeSessionTitle(title) ?? null)
}

/** A signer lent in a session goes with it: archiving or deleting revokes it. */
function revokeLentSigners(session: ChatSessionKey): void {
  const store = useNip46Store.getState()
  const lent = store.sessions.filter(
    (candidate) =>
      candidate.signerNpub === session.identityNpub &&
      candidate.origin?.kind === 'chat' &&
      candidate.origin.peerPubkey === session.peerPubkey &&
      candidate.origin.sessionId === session.sessionId
  )
  for (const candidate of lent) {
    stopNip46Session(candidate.id)
    store.removeSession(candidate.id)
  }
}

function archiveChatSession(session: ChatSessionKey, archived: boolean): void {
  ensureChatSessionRow(session)
  setChatSessionArchived(session, archived)
  if (archived) {
    revokeLentSigners(session)
  }
}

function forgetChatSession(session: ChatSessionKey): void {
  revokeLentSigners(session)
  deleteChatSession(session)
}

function isDefaultChatSession(sessionId: string): boolean {
  return sessionId === NOSTR_CHAT_DEFAULT_SESSION_ID
}

type LabeledConversation = NostrChatConversationItem & {
  sessionLabel?: string
}

function getSessionLabel(
  conversation: NostrChatConversationItem,
  peerSessionCount: number
): string | undefined {
  if (conversation.title || peerSessionCount < 2) {
    return conversation.title
  }
  return isDefaultChatSession(conversation.sessionId)
    ? t('nostrIdentity.chat.sessions.defaultTitle')
    : t('nostrIdentity.chat.sessions.untitled')
}

/** Rows name their session only when it has a title or the peer has several. */
function labelConversationSessions(
  conversations: NostrChatConversationItem[]
): LabeledConversation[] {
  const counts = countSessionsByPeer(conversations)
  return conversations.map((conversation) => ({
    ...conversation,
    sessionLabel: getSessionLabel(
      conversation,
      counts.get(conversation.peerPubkey) ?? 0
    )
  }))
}

function getConversationKey(item: NostrChatConversationItem): string {
  return `${item.peerPubkey}:${item.sessionId}`
}

/** How many listed sessions each peer has, to label rows only when it matters. */
function countSessionsByPeer(
  conversations: NostrChatConversationItem[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { peerPubkey } of conversations) {
    counts.set(peerPubkey, (counts.get(peerPubkey) ?? 0) + 1)
  }
  return counts
}

export {
  archiveChatSession,
  countSessionsByPeer,
  createChatSessionId,
  forgetChatSession,
  getConversationKey,
  isDefaultChatSession,
  labelConversationSessions,
  renameChatSessionTitle,
  revokeLentSigners,
  startChatSession
}
export type { LabeledConversation }
