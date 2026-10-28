import { type NostrChatMessage } from '@/types/models/Nostr'

import { getDb } from '../connection'
import { boolToInt } from '../mappers'
import {
  chatProcessedScope,
  clearNostrProcessedEvents
} from '../nostrProcessedEvents'

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

/** Returns how many messages flipped to read. */
function markChatThreadRead(
  identityNpub: string,
  protocol: string,
  peerPubkey: string
): number {
  const { rowsAffected } = getDb().execute(
    `UPDATE nostr_chat_messages SET read = 1
      WHERE identity_npub = ? AND protocol = ? AND peer_pubkey = ? AND read = 0`,
    [identityNpub, protocol, peerPubkey]
  )
  return rowsAffected ?? 0
}

/**
 * Also forgets which gift wraps were decrypted, otherwise re-adding the
 * identity would skip every wrap and never restore its history.
 */
function deleteChatMessagesForIdentity(identityNpub: string) {
  getDb().execute('DELETE FROM nostr_chat_messages WHERE identity_npub = ?', [
    identityNpub
  ])
  clearNostrProcessedEvents(chatProcessedScope(identityNpub))
}

export {
  deleteChatMessagesForIdentity,
  insertChatMessage,
  markChatThreadRead,
  updateChatMessageStatus
}
