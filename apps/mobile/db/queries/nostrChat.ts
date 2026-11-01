import {
  type NostrChatConversation,
  type NostrChatMessage,
  type NostrChatProtocol
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
}

type ChatConversationRow = {
  last_message_at: number
  last_message_preview: string
  peer_pubkey: string
  unread_count: number | null
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
    status:
      row.status === 'pending' || row.status === 'failed' ? row.status : 'sent'
  }
}

function listChatConversations(
  identityNpub: string,
  protocol: NostrChatProtocol
): NostrChatConversation[] {
  // SQLite fills bare columns (content) from the row that produced MAX(),
  // so one grouped query yields each conversation's latest preview.
  const { rows } = getDb().execute<ChatConversationRow>(
    `SELECT peer_pubkey,
            content AS last_message_preview,
            MAX(created_at) AS last_message_at,
            SUM(CASE WHEN read = 0 AND direction = 'in' THEN 1 ELSE 0 END)
              AS unread_count
       FROM nostr_chat_messages
      WHERE identity_npub = ? AND protocol = ?
      GROUP BY peer_pubkey
      ORDER BY last_message_at DESC`,
    [identityNpub, protocol]
  )

  return rows._array.map((row) => ({
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview ?? '',
    peerPubkey: row.peer_pubkey,
    unreadCount: row.unread_count ?? 0
  }))
}

function listChatThread(
  identityNpub: string,
  protocol: NostrChatProtocol,
  peerPubkey: string,
  limit: number
): NostrChatMessage[] {
  const { rows } = getDb().execute<ChatMessageRow>(
    `SELECT * FROM nostr_chat_messages
      WHERE identity_npub = ? AND protocol = ? AND peer_pubkey = ?
      ORDER BY created_at DESC LIMIT ?`,
    [identityNpub, protocol, peerPubkey, limit]
  )
  return rows._array.map((row) => rowToChatMessage(row)).toReversed()
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

export {
  getNewestSentChatMessageCreatedAt,
  getOldestChatMessageCreatedAt,
  hasChatMessage,
  listChatConversations,
  listChatThread
}
