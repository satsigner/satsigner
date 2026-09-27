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
  peer_pubkey: string
  last_message_at: number
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
  const db = getDb()
  const { rows } = db.execute<ChatConversationRow>(
    `SELECT peer_pubkey,
            MAX(created_at) AS last_message_at,
            SUM(CASE WHEN read = 0 AND direction = 'in' THEN 1 ELSE 0 END)
              AS unread_count
       FROM nostr_chat_messages
      WHERE identity_npub = ? AND protocol = ?
      GROUP BY peer_pubkey
      ORDER BY last_message_at DESC`,
    [identityNpub, protocol]
  )

  return rows._array.map((row) => {
    const { rows: previewRows } = db.execute<{ content: string }>(
      `SELECT content FROM nostr_chat_messages
        WHERE identity_npub = ? AND protocol = ? AND peer_pubkey = ?
        ORDER BY created_at DESC LIMIT 1`,
      [identityNpub, protocol, row.peer_pubkey]
    )
    return {
      lastMessageAt: row.last_message_at,
      lastMessagePreview: previewRows.item(0)?.content ?? '',
      peerPubkey: row.peer_pubkey,
      unreadCount: row.unread_count ?? 0
    }
  })
}

function listChatThread(
  identityNpub: string,
  protocol: NostrChatProtocol,
  peerPubkey: string,
  limit = 100,
  before?: number
): NostrChatMessage[] {
  const db = getDb()
  const { rows } = db.execute<ChatMessageRow>(
    `SELECT * FROM nostr_chat_messages
      WHERE identity_npub = ? AND protocol = ? AND peer_pubkey = ?
        ${before ? 'AND created_at < ?' : ''}
      ORDER BY created_at DESC LIMIT ?`,
    before
      ? [identityNpub, protocol, peerPubkey, before, limit]
      : [identityNpub, protocol, peerPubkey, limit]
  )
  return rows._array.map((row) => rowToChatMessage(row)).toReversed()
}

function getChatMessageById(
  identityNpub: string,
  id: string
): NostrChatMessage | null {
  const db = getDb()
  const row = db
    .execute<ChatMessageRow>(
      'SELECT * FROM nostr_chat_messages WHERE identity_npub = ? AND id = ?',
      [identityNpub, id]
    )
    .rows.item(0)
  return row ? rowToChatMessage(row) : null
}

export { getChatMessageById, listChatConversations, listChatThread }
