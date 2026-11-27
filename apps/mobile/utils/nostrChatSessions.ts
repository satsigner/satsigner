import { bytesToHex } from '@noble/hashes/utils'
import QuickCrypto from 'react-native-quick-crypto'

import {
  NOSTR_CHAT_DEFAULT_SESSION_ID,
  NOSTR_CHAT_SESSION_ID_BYTES,
  NOSTR_PRIVACY_MASK
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

function archiveChatSession(session: ChatSessionKey, archived: boolean): void {
  ensureChatSessionRow(session)
  setChatSessionArchived(session, archived)
}

function forgetChatSession(session: ChatSessionKey): void {
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

/**
 * Rows name their session only when it has a title or the peer has several.
 * In privacy mode a named row shows the mask instead of its title.
 */
function labelConversationSessions(
  conversations: NostrChatConversationItem[],
  privacyMode = false
): LabeledConversation[] {
  const counts = countSessionsByPeer(conversations)
  return conversations.map((conversation) => {
    const label = getSessionLabel(
      conversation,
      counts.get(conversation.peerPubkey) ?? 0
    )
    return {
      ...conversation,
      sessionLabel: label && privacyMode ? NOSTR_PRIVACY_MASK : label
    }
  })
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

type ConversationRow = LabeledConversation & {
  /** A further session with the same peer, shown under its main one. */
  nested: boolean
}

/**
 * Sessions grouped by peer: the main session first, the peer's other
 * sessions indented under it. Peers keep the order of their most recent
 * session, and sessions within a peer keep theirs. A peer whose main session
 * isn't listed is headed by its most recent session.
 */
function groupConversationSessions(
  conversations: LabeledConversation[]
): ConversationRow[] {
  const byPeer = new Map<string, LabeledConversation[]>()
  for (const conversation of conversations) {
    const group = byPeer.get(conversation.peerPubkey) ?? []
    group.push(conversation)
    byPeer.set(conversation.peerPubkey, group)
  }
  return [...byPeer.values()].flatMap((group) => {
    const main =
      group.find((item) => isDefaultChatSession(item.sessionId)) ?? group[0]
    return [
      { ...main, nested: false },
      ...group
        .filter((item) => item !== main)
        .map((item) => ({ ...item, nested: true }))
    ]
  })
}

/** Labeled and grouped rows for the conversation list. */
function buildConversationRows(
  conversations: NostrChatConversationItem[],
  privacyMode = false
): ConversationRow[] {
  return groupConversationSessions(
    labelConversationSessions(conversations, privacyMode)
  )
}

export {
  archiveChatSession,
  buildConversationRows,
  countSessionsByPeer,
  createChatSessionId,
  forgetChatSession,
  getConversationKey,
  groupConversationSessions,
  isDefaultChatSession,
  labelConversationSessions,
  renameChatSessionTitle,
  startChatSession
}
export type { ConversationRow, LabeledConversation }
