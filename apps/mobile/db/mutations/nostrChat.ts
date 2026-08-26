import { type NostrChatMessage } from '@/types/models/Nostr'

import { getDb } from '../connection'
import { boolToInt } from '../mappers'

/** INSERT OR IGNORE: relay redelivery must not duplicate (id, identity). */
function insertChatMessage(message: NostrChatMessage): boolean {
  const db = getDb()
  const { rowsAffected } = db.execute(
    `INSERT OR IGNORE INTO nostr_chat_messages (
      id, identity_npub, peer_pubkey, protocol, direction,
      content, status, read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.identityNpub,
      message.peerPubkey,
      message.protocol,
      message.direction,
      message.content,
      message.status,
      boolToInt(message.read),
      message.created_at
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

function markChatThreadRead(
  identityNpub: string,
  protocol: string,
  peerPubkey: string
) {
  const db = getDb()
  db.execute(
    `UPDATE nostr_chat_messages SET read = 1
      WHERE identity_npub = ? AND protocol = ? AND peer_pubkey = ? AND read = 0`,
    [identityNpub, protocol, peerPubkey]
  )
}

function deleteChatMessagesForIdentity(identityNpub: string) {
  const db = getDb()
  db.execute('DELETE FROM nostr_chat_messages WHERE identity_npub = ?', [
    identityNpub
  ])
}

export {
  deleteChatMessagesForIdentity,
  insertChatMessage,
  markChatThreadRead,
  updateChatMessageStatus
}
