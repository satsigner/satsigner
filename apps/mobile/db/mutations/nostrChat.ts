import type {
  NostrChatMessage,
  NostrChatReaction,
  NostrChatSession,
  NostrChatThreadRef
} from '@/types/models/Nostr'

import { getDb, runTransaction } from '../connection'
import { boolToInt } from '../mappers'
import { clearMessageState } from '../nostrMessageState'
import {
  chatProcessedScope,
  clearNostrProcessedEvents
} from '../nostrProcessedEvents'

function toJsonOrNull(value: object | undefined): string | null {
  return value === undefined ? null : JSON.stringify(value)
}

/** INSERT OR IGNORE: relay redelivery must not duplicate (id, identity). */
function insertChatMessage(message: NostrChatMessage): boolean {
  const db = getDb()
  const { rowsAffected } = db.execute(
    `INSERT OR IGNORE INTO nostr_chat_messages (
      id, identity_npub, peer_pubkey, protocol, direction,
      content, status, read, created_at, reply_to_id, session_id,
      agent_cost, agent_model
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.identityNpub,
      message.peerPubkey,
      message.protocol,
      message.direction,
      message.content,
      message.status,
      boolToInt(message.read),
      message.created_at,
      message.replyToId ?? null,
      message.sessionId,
      toJsonOrNull(message.agentCost),
      toJsonOrNull(message.agentModel)
    ]
  )
  return (rowsAffected ?? 0) > 0
}

function updateChatMessageStatus(
  identityNpub: string,
  id: string,
  status: NostrChatMessage['status']
) {
  const db = getDb()
  db.execute(
    'UPDATE nostr_chat_messages SET status = ? WHERE identity_npub = ? AND id = ?',
    [status, identityNpub, id]
  )
}

/**
 * A message is stored as pending before it is published, so one still pending
 * when this process starts was cut short by an app kill: it failed, and its
 * retry must be offered instead of a spinner that never ends.
 */
function failInterruptedChatSends(identityNpub: string) {
  getDb().execute(
    `UPDATE nostr_chat_messages SET status = 'failed'
      WHERE identity_npub = ? AND status = 'pending'`,
    [identityNpub]
  )
}

/** Returns how many messages flipped to read. */
function markChatThreadRead(thread: NostrChatThreadRef): number {
  const { rowsAffected } = getDb().execute(
    `UPDATE nostr_chat_messages SET read = 1
      WHERE identity_npub = ? AND protocol = ? AND peer_pubkey = ?
        AND session_id = ? AND read = 0`,
    [thread.identityNpub, thread.protocol, thread.peerPubkey, thread.sessionId]
  )
  return rowsAffected ?? 0
}

/** INSERT OR IGNORE: an existing session keeps its title and flags. */
function insertChatSession(session: NostrChatSession): boolean {
  const { rowsAffected } = getDb().execute(
    `INSERT OR IGNORE INTO nostr_chat_sessions (
      identity_npub, peer_pubkey, session_id, title, title_locked,
      created_at, archived
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      session.identityNpub,
      session.peerPubkey,
      session.sessionId,
      session.title ?? null,
      boolToInt(session.titleLocked ?? false),
      session.createdAt,
      boolToInt(session.archived)
    ]
  )
  return (rowsAffected ?? 0) > 0
}

type ChatSessionKey = Pick<
  NostrChatSession,
  'identityNpub' | 'peerPubkey' | 'sessionId'
>

function sessionKeyParams(session: ChatSessionKey): string[] {
  return [session.identityNpub, session.peerPubkey, session.sessionId]
}

/** A rename (or clearing the title) locks it against a peer's subject. */
function renameChatSession(session: ChatSessionKey, title: string | null) {
  getDb().execute(
    `UPDATE nostr_chat_sessions SET title = ?, title_locked = 1
      WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?`,
    [title, ...sessionKeyParams(session)]
  )
}

/**
 * A subject that arrives after the session was created (wraps arrive out of
 * order) still names it, unless it already has a title or the user locked it.
 */
function adoptChatSessionSubject(session: ChatSessionKey, title: string) {
  getDb().execute(
    `UPDATE nostr_chat_sessions SET title = ?
      WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?
        AND title IS NULL AND title_locked = 0`,
    [title, ...sessionKeyParams(session)]
  )
}

function setChatSessionArchived(session: ChatSessionKey, archived: boolean) {
  getDb().execute(
    `UPDATE nostr_chat_sessions SET archived = ?
      WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?`,
    [boolToInt(archived), ...sessionKeyParams(session)]
  )
}

/** Drops the session's messages and their reactions, then the session row. */
function deleteChatSession(session: ChatSessionKey) {
  const params = sessionKeyParams(session)
  runTransaction((tx) => {
    tx.execute(
      `DELETE FROM nostr_chat_reactions
        WHERE identity_npub = ? AND message_id IN (
          SELECT id FROM nostr_chat_messages
           WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?
        )`,
      [session.identityNpub, ...params]
    )
    tx.execute(
      `DELETE FROM nostr_chat_messages
        WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?`,
      params
    )
    tx.execute(
      `DELETE FROM nostr_chat_sessions
        WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?`,
      params
    )
    tx.execute(
      `DELETE FROM nostr_chat_session_states
        WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?`,
      params
    )
  })
}

type ChatSessionStateRecord = ChatSessionKey & {
  author: string
  content: string
  createdAt: number
}

/**
 * Keeps the newest document per session and author; wraps arrive in random
 * order, so an older one never replaces a newer one. Returns whether it was
 * stored.
 */
function upsertChatSessionState(record: ChatSessionStateRecord): boolean {
  const { rowsAffected } = getDb().execute(
    `INSERT INTO nostr_chat_session_states (
      identity_npub, peer_pubkey, session_id, author, content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(identity_npub, peer_pubkey, session_id, author) DO UPDATE
      SET content = excluded.content, created_at = excluded.created_at
      WHERE excluded.created_at > nostr_chat_session_states.created_at`,
    [
      record.identityNpub,
      record.peerPubkey,
      record.sessionId,
      record.author,
      record.content,
      record.createdAt
    ]
  )
  return (rowsAffected ?? 0) > 0
}

/** A deleted message takes its reactions with it. */
function deleteChatMessages(identityNpub: string, ids: string[]) {
  runTransaction((tx) => {
    for (const id of ids) {
      tx.execute(
        'DELETE FROM nostr_chat_messages WHERE identity_npub = ? AND id = ?',
        [identityNpub, id]
      )
      tx.execute(
        'DELETE FROM nostr_chat_reactions WHERE identity_npub = ? AND message_id = ?',
        [identityNpub, id]
      )
    }
  })
}

/** INSERT OR IGNORE: relay redelivery must not duplicate a reaction. */
function insertChatReaction(reaction: NostrChatReaction): boolean {
  const { rowsAffected } = getDb().execute(
    `INSERT OR IGNORE INTO nostr_chat_reactions (
      id, identity_npub, message_id, author, emoji, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      reaction.id,
      reaction.identityNpub,
      reaction.messageId,
      reaction.author,
      reaction.emoji,
      reaction.created_at
    ]
  )
  return (rowsAffected ?? 0) > 0
}

/** Only the author can remove a reaction. */
function deleteChatReactions(
  identityNpub: string,
  author: string,
  ids: string[]
): void {
  runTransaction((tx) => {
    for (const id of ids) {
      tx.execute(
        'DELETE FROM nostr_chat_reactions WHERE identity_npub = ? AND id = ? AND author = ?',
        [identityNpub, id, author]
      )
    }
  })
}

/**
 * Also forgets which gift wraps were decrypted, otherwise re-adding the
 * identity would skip every wrap and never restore its history, and the
 * wraps it sent and the messages it deleted.
 */
function deleteChatMessagesForIdentity(identityNpub: string) {
  getDb().execute('DELETE FROM nostr_chat_messages WHERE identity_npub = ?', [
    identityNpub
  ])
  getDb().execute('DELETE FROM nostr_chat_reactions WHERE identity_npub = ?', [
    identityNpub
  ])
  getDb().execute('DELETE FROM nostr_chat_sessions WHERE identity_npub = ?', [
    identityNpub
  ])
  getDb().execute(
    'DELETE FROM nostr_chat_session_states WHERE identity_npub = ?',
    [identityNpub]
  )
  clearNostrProcessedEvents(chatProcessedScope(identityNpub))
  clearMessageState(chatProcessedScope(identityNpub))
}

export {
  adoptChatSessionSubject,
  deleteChatMessages,
  deleteChatMessagesForIdentity,
  deleteChatReactions,
  deleteChatSession,
  failInterruptedChatSends,
  insertChatMessage,
  insertChatReaction,
  insertChatSession,
  markChatThreadRead,
  renameChatSession,
  setChatSessionArchived,
  updateChatMessageStatus,
  upsertChatSessionState
}
export type { ChatSessionKey }
