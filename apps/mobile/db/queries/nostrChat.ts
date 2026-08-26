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
  const { results } = db.execute(
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

  return (results ?? []).map((row) => {
    const { results: previewRows } = db.execute(
      `SELECT content FROM nostr_chat_messages
        WHERE identity_npub = ? AND protocol = ? AND peer_pubkey = ?
        ORDER BY created_at DESC LIMIT 1`,
      [identityNpub, protocol, row.peer_pubkey]
    )
    return {
      lastMessageAt: row.last_message_at as number,
      lastMessagePreview: (previewRows?.[0]?.content as string) ?? '',
      peerPubkey: row.peer_pubkey as string,
      unreadCount: (row.unread_count as number) ?? 0
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
  const { results } = db.execute(
    `SELECT * FROM nostr_chat_messages
      WHERE identity_npub = ? AND protocol = ? AND peer_pubkey = ?
        ${before ? 'AND created_at < ?' : ''}
      ORDER BY created_at DESC LIMIT ?`,
    before
      ? [identityNpub, protocol, peerPubkey, before, limit]
      : [identityNpub, protocol, peerPubkey, limit]
  )
  return (results ?? [])
    .map((row) => rowToChatMessage(row as ChatMessageRow))
    .toReversed()
}

function getChatMessageById(
  identityNpub: string,
  id: string
): NostrChatMessage | null {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM nostr_chat_messages WHERE identity_npub = ? AND id = ?',
    [identityNpub, id]
  )
  const row = results?.[0] as ChatMessageRow | undefined
  return row ? rowToChatMessage(row) : null
}

export { getChatMessageById, listChatConversations, listChatThread }
