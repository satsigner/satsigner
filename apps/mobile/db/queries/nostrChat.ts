import type { z } from 'zod'

import {
  NostrChatAgentCostSchema,
  NostrChatAgentModelSchema,
  NostrChatSessionStateSchema
} from '@/types/models/Nostr'
import type {
  NostrChatConversation,
  NostrChatMessage,
  NostrChatProtocol,
  NostrChatReaction,
  NostrChatSession,
  NostrChatStoredSessionState,
  NostrChatThreadRef
} from '@/types/models/Nostr'

import { getDb } from '../connection'

type ChatMessageRow = {
  id: string
  identity_npub: string
  peer_pubkey: string
  protocol: string
  direction: string
  content: string
  status: string
  read: number
  created_at: number
  reply_to_id?: string | null
  session_id?: string | null
  agent_cost?: string | null
  agent_model?: string | null
}

type ChatSessionStateRow = {
  content: string
  created_at: number
}

/** Stored JSON is re-validated on read: a row is never trusted blindly. */
function parseStoredJson<T extends z.ZodType>(
  json: string | null | undefined,
  schema: T
): z.infer<T> | undefined {
  if (!json) {
    return undefined
  }
  try {
    const parsed = schema.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

type ChatReactionRow = {
  id: string
  identity_npub: string
  message_id: string
  author: string
  emoji: string
  created_at: number
}

type ChatConversationRow = {
  last_message_at: number
  last_message_preview: string
  peer_pubkey: string
  session_id: string
  title: string | null
  unread_count: number | null
}

type ChatSessionRow = {
  archived: number
  title_locked?: number | null
  created_at: number
  identity_npub: string
  peer_pubkey: string
  session_id: string
  title: string | null
}

const THREAD_WHERE =
  'identity_npub = ? AND protocol = ? AND peer_pubkey = ? AND session_id = ?'

function threadParams(thread: NostrChatThreadRef): string[] {
  return [
    thread.identityNpub,
    thread.protocol,
    thread.peerPubkey,
    thread.sessionId
  ]
}

function rowToChatMessage(row: ChatMessageRow): NostrChatMessage {
  return {
    content: row.content,
    created_at: row.created_at,
    direction: row.direction === 'out' ? 'out' : 'in',
    id: row.id,
    identityNpub: row.identity_npub,
    peerPubkey: row.peer_pubkey,
    protocol: row.protocol === 'nip04' ? 'nip04' : 'nip17',
    read: row.read === 1,
    ...(row.reply_to_id ? { replyToId: row.reply_to_id } : {}),
    ...agentFields(row),
    sessionId: row.session_id ?? '',
    status:
      row.status === 'pending' || row.status === 'failed' ? row.status : 'sent'
  }
}

function agentFields(
  row: ChatMessageRow
): Pick<NostrChatMessage, 'agentCost' | 'agentModel'> {
  const agentCost = parseStoredJson(row.agent_cost, NostrChatAgentCostSchema)
  const agentModel = parseStoredJson(row.agent_model, NostrChatAgentModelSchema)
  return {
    ...(agentCost ? { agentCost } : {}),
    ...(agentModel ? { agentModel } : {})
  }
}

// SQLite fills bare columns (content) from the row that produced MAX(), so
// one grouped query yields each conversation's latest preview.
const MESSAGE_CONVERSATIONS_SQL = `
  SELECT m.peer_pubkey,
         m.session_id,
         s.title,
         m.content AS last_message_preview,
         MAX(m.created_at) AS last_message_at,
         SUM(CASE WHEN m.read = 0 AND m.direction = 'in' THEN 1 ELSE 0 END)
           AS unread_count
    FROM nostr_chat_messages m
    LEFT JOIN nostr_chat_sessions s
      ON s.identity_npub = m.identity_npub
     AND s.peer_pubkey = m.peer_pubkey
     AND s.session_id = m.session_id
   WHERE m.identity_npub = ? AND m.protocol = 'nip17'
     AND COALESCE(s.archived, 0) = 0
   GROUP BY m.peer_pubkey, m.session_id`

// A named session with no message yet, so it can be reopened from the list.
const EMPTY_SESSIONS_SQL = `
  SELECT s.peer_pubkey, s.session_id, s.title, '' AS last_message_preview,
         s.created_at AS last_message_at, 0 AS unread_count
    FROM nostr_chat_sessions s
   WHERE s.identity_npub = ? AND s.archived = 0 AND s.session_id != ''
     AND NOT EXISTS (
       SELECT 1 FROM nostr_chat_messages m
        WHERE m.identity_npub = s.identity_npub
          AND m.peer_pubkey = s.peer_pubkey
          AND m.session_id = s.session_id
          AND m.protocol = 'nip17'
     )`

// NIP-04 has no sessions, so session rows (title, archive) never apply to it.
const NIP04_CONVERSATIONS_SQL = `
  SELECT peer_pubkey,
         session_id,
         NULL AS title,
         content AS last_message_preview,
         MAX(created_at) AS last_message_at,
         SUM(CASE WHEN read = 0 AND direction = 'in' THEN 1 ELSE 0 END)
           AS unread_count
    FROM nostr_chat_messages
   WHERE identity_npub = ? AND protocol = 'nip04'
   GROUP BY peer_pubkey`

function conversationsQuery(
  identityNpub: string,
  protocol: NostrChatProtocol
): { params: string[]; sql: string } {
  if (protocol === 'nip04') {
    return {
      params: [identityNpub],
      sql: `${NIP04_CONVERSATIONS_SQL} ORDER BY last_message_at DESC`
    }
  }
  return {
    params: [identityNpub, identityNpub],
    sql: `${MESSAGE_CONVERSATIONS_SQL} UNION ALL ${EMPTY_SESSIONS_SQL}
      ORDER BY last_message_at DESC`
  }
}

function listChatConversations(
  identityNpub: string,
  protocol: NostrChatProtocol
): NostrChatConversation[] {
  const { params, sql } = conversationsQuery(identityNpub, protocol)
  const { rows } = getDb().execute<ChatConversationRow>(sql, params)

  return rows._array.map((row) => ({
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview ?? '',
    peerPubkey: row.peer_pubkey,
    sessionId: row.session_id ?? '',
    ...(row.title ? { title: row.title } : {}),
    unreadCount: row.unread_count ?? 0
  }))
}

function listChatThread(
  thread: NostrChatThreadRef,
  limit: number
): NostrChatMessage[] {
  const { rows } = getDb().execute<ChatMessageRow>(
    `SELECT * FROM nostr_chat_messages
      WHERE ${THREAD_WHERE}
      ORDER BY created_at DESC, id DESC LIMIT ?`,
    [...threadParams(thread), limit]
  )
  return rows._array.map((row) => rowToChatMessage(row)).toReversed()
}

/** Reactions on the newest `limit` messages of a thread (the loaded window). */
function listChatThreadReactions(
  thread: NostrChatThreadRef,
  limit: number
): NostrChatReaction[] {
  const { rows } = getDb().execute<ChatReactionRow>(
    `SELECT r.* FROM nostr_chat_reactions r
      WHERE r.identity_npub = ? AND r.message_id IN (
        SELECT id FROM nostr_chat_messages
         WHERE ${THREAD_WHERE}
         ORDER BY created_at DESC, id DESC LIMIT ?
      )
      ORDER BY r.created_at ASC`,
    [thread.identityNpub, ...threadParams(thread), limit]
  )
  return rows._array.map((row) => ({
    author: row.author,
    created_at: row.created_at,
    emoji: row.emoji,
    id: row.id,
    identityNpub: row.identity_npub,
    messageId: row.message_id
  }))
}

/** Newest relay-confirmed message: the live subscription's catch-up cursor. */
function getNewestSentChatMessageCreatedAt(
  identityNpub: string,
  protocol: NostrChatProtocol
): number | null {
  const row = getDb()
    .execute<{ newest: number | null }>(
      `SELECT MAX(created_at) AS newest FROM nostr_chat_messages
        WHERE identity_npub = ? AND protocol = ? AND status = 'sent'`,
      [identityNpub, protocol]
    )
    .rows.item(0)
  return row?.newest ?? null
}

function getOldestChatMessageCreatedAt(
  identityNpub: string,
  protocol: NostrChatProtocol
): number | null {
  const row = getDb()
    .execute<{ oldest: number | null }>(
      `SELECT MIN(created_at) AS oldest FROM nostr_chat_messages
        WHERE identity_npub = ? AND protocol = ?`,
      [identityNpub, protocol]
    )
    .rows.item(0)
  return row?.oldest ?? null
}

function hasChatMessage(identityNpub: string, id: string): boolean {
  const { rows } = getDb().execute<{ id: string }>(
    'SELECT id FROM nostr_chat_messages WHERE identity_npub = ? AND id = ? LIMIT 1',
    [identityNpub, id]
  )
  return rows.length > 0
}

function getChatMessage(
  identityNpub: string,
  id: string
): NostrChatMessage | null {
  const row = getDb()
    .execute<ChatMessageRow>(
      'SELECT * FROM nostr_chat_messages WHERE identity_npub = ? AND id = ? LIMIT 1',
      [identityNpub, id]
    )
    .rows.item(0)
  return row ? rowToChatMessage(row) : null
}

function hasOutgoingChatMessage(
  identityNpub: string,
  peerPubkey: string
): boolean {
  const { rows } = getDb().execute<{ id: string }>(
    `SELECT id FROM nostr_chat_messages
      WHERE identity_npub = ? AND peer_pubkey = ? AND direction = 'out' LIMIT 1`,
    [identityNpub, peerPubkey]
  )
  return rows.length > 0
}

type ChatMessageInChat = NostrChatThreadRef &
  Pick<NostrChatMessage, 'id' | 'replyToId'>

// Reply links stay inside the message's own chat: anyone can reference the
// id of a message from another conversation.
function getChatReplyParent(
  message: ChatMessageInChat
): NostrChatMessage | null {
  if (!message.replyToId) {
    return null
  }
  const row = getDb()
    .execute<ChatMessageRow>(
      `SELECT * FROM nostr_chat_messages
        WHERE ${THREAD_WHERE} AND id = ?
        LIMIT 1`,
      [...threadParams(message), message.replyToId]
    )
    .rows.item(0)
  return row ? rowToChatMessage(row) : null
}

function listChatReplies(parent: ChatMessageInChat): NostrChatMessage[] {
  return getDb()
    .execute<ChatMessageRow>(
      `SELECT * FROM nostr_chat_messages
        WHERE ${THREAD_WHERE} AND reply_to_id = ?
        ORDER BY created_at ASC`,
      [...threadParams(parent), parent.id]
    )
    .rows._array.map(rowToChatMessage)
}

// Over any protocol: writing to someone is about the person, not the
// transport, as for hasOutgoingChatMessage.
function listPeersWrittenTo(identityNpub: string): string[] {
  return getDb()
    .execute<{ peer_pubkey: string }>(
      `SELECT DISTINCT peer_pubkey FROM nostr_chat_messages
        WHERE identity_npub = ? AND direction = 'out'`,
      [identityNpub]
    )
    .rows._array.map((row) => row.peer_pubkey)
}

/**
 * Where a message written in reply belongs: its parent's session, looked up
 * only within the same identity and peer so a reference to another chat's
 * message can't pull it in.
 */
function getChatReplyParentSessionId(
  identityNpub: string,
  peerPubkey: string,
  parentId: string
): string | null {
  const row = getDb()
    .execute<{ session_id: string }>(
      `SELECT session_id FROM nostr_chat_messages
        WHERE identity_npub = ? AND peer_pubkey = ? AND id = ? LIMIT 1`,
      [identityNpub, peerPubkey, parentId]
    )
    .rows.item(0)
  return row?.session_id ?? null
}

function rowToChatSession(row: ChatSessionRow): NostrChatSession {
  return {
    archived: row.archived === 1,
    createdAt: row.created_at,
    identityNpub: row.identity_npub,
    peerPubkey: row.peer_pubkey,
    sessionId: row.session_id,
    ...(row.title ? { title: row.title } : {}),
    ...(row.title_locked === 1 ? { titleLocked: true } : {})
  }
}

/** Archived NIP-17 sessions with a peer, newest first, to bring them back. */
function listArchivedChatSessions(
  identityNpub: string,
  peerPubkey: string
): NostrChatSession[] {
  return getDb()
    .execute<ChatSessionRow>(
      `SELECT * FROM nostr_chat_sessions
        WHERE identity_npub = ? AND peer_pubkey = ? AND archived = 1
        ORDER BY created_at DESC`,
      [identityNpub, peerPubkey]
    )
    .rows._array.map(rowToChatSession)
}

function getChatSession(
  identityNpub: string,
  peerPubkey: string,
  sessionId: string
): NostrChatSession | null {
  const row = getDb()
    .execute<ChatSessionRow>(
      `SELECT * FROM nostr_chat_sessions
        WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ? LIMIT 1`,
      [identityNpub, peerPubkey, sessionId]
    )
    .rows.item(0)
  return row ? rowToChatSession(row) : null
}

function countChatSessions(identityNpub: string, peerPubkey: string): number {
  const row = getDb()
    .execute<{ total: number }>(
      `SELECT COUNT(*) AS total FROM nostr_chat_sessions
        WHERE identity_npub = ? AND peer_pubkey = ?`,
      [identityNpub, peerPubkey]
    )
    .rows.item(0)
  return row?.total ?? 0
}

/**
 * Every message we sent in a session, whatever its status: a send whose peer
 * copy was accepted can still read `pending` (self copy in flight) or
 * `failed` (app killed meanwhile), and the peer must be asked to drop it.
 * Asking about one that never arrived is harmless.
 */
function listOwnChatSessionMessageIds(
  identityNpub: string,
  peerPubkey: string,
  sessionId: string
): string[] {
  return getDb()
    .execute<{ id: string }>(
      `SELECT id FROM nostr_chat_messages
        WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?
          AND protocol = 'nip17' AND direction = 'out'`,
      [identityNpub, peerPubkey, sessionId]
    )
    .rows._array.map((row) => row.id)
}

/** Whether the peer has a message of ours in this session (it carried the title). */
function hasDeliveredChatSessionMessage(
  identityNpub: string,
  peerPubkey: string,
  sessionId: string
): boolean {
  const { rows } = getDb().execute<{ id: string }>(
    `SELECT id FROM nostr_chat_messages
      WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?
        AND protocol = 'nip17' AND direction = 'out' AND status = 'sent'
      LIMIT 1`,
    [identityNpub, peerPubkey, sessionId]
  )
  return rows.length > 0
}

/** The newest session state document `author` sent for this session. */
function getChatSessionState(
  identityNpub: string,
  peerPubkey: string,
  sessionId: string,
  author: string
): NostrChatStoredSessionState | null {
  const row = getDb()
    .execute<ChatSessionStateRow>(
      `SELECT content, created_at FROM nostr_chat_session_states
        WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?
          AND author = ? LIMIT 1`,
      [identityNpub, peerPubkey, sessionId, author]
    )
    .rows.item(0)
  const state = parseStoredJson(row?.content, NostrChatSessionStateSchema)
  return row && state ? { state, updatedAt: row.created_at } : null
}

export {
  countChatSessions,
  getChatSessionState,
  getChatMessage,
  getChatReplyParent,
  getChatReplyParentSessionId,
  getChatSession,
  hasDeliveredChatSessionMessage,
  getNewestSentChatMessageCreatedAt,
  getOldestChatMessageCreatedAt,
  hasChatMessage,
  hasOutgoingChatMessage,
  listChatConversations,
  listChatReplies,
  listChatThread,
  listArchivedChatSessions,
  listChatThreadReactions,
  listOwnChatSessionMessageIds,
  listPeersWrittenTo
}
