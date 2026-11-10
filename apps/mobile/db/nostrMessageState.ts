import { NOSTR_PROCESSED_EVENTS_QUERY_CHUNK } from '@/constants/nostr'
import { chunk } from '@/utils/array'

import { getDb, runTransaction } from './connection'

type NostrMessageWrap = { recipientPubkey: string; wrapId: string }

type NostrMessageTombstone = { author: string; messageId: string }

function recordMessageWraps(
  scope: string,
  messageId: string,
  wraps: NostrMessageWrap[]
): void {
  if (wraps.length === 0) {
    return
  }
  runTransaction((db) => {
    for (const { recipientPubkey, wrapId } of wraps) {
      db.execute(
        `INSERT OR IGNORE INTO nostr_message_wraps
           (scope, message_id, wrap_id, recipient_pubkey)
         VALUES (?, ?, ?, ?)`,
        [scope, messageId, wrapId, recipientPubkey]
      )
    }
  })
}

function getMessageWraps(scope: string, messageId: string): NostrMessageWrap[] {
  return getDb()
    .execute<{ recipient_pubkey: string; wrap_id: string }>(
      `SELECT wrap_id, recipient_pubkey FROM nostr_message_wraps
       WHERE scope = ? AND message_id = ?`,
      [scope, messageId]
    )
    .rows._array.map((row) => ({
      recipientPubkey: row.recipient_pubkey,
      wrapId: row.wrap_id
    }))
}

function deleteMessageWraps(scope: string, messageIds: string[]): void {
  runTransaction((db) => {
    for (const messageId of messageIds) {
      db.execute(
        'DELETE FROM nostr_message_wraps WHERE scope = ? AND message_id = ?',
        [scope, messageId]
      )
    }
  })
}

function tombstoneMessages(
  scope: string,
  tombstones: NostrMessageTombstone[],
  deletedAt: number
): void {
  if (tombstones.length === 0) {
    return
  }
  runTransaction((db) => {
    for (const { author, messageId } of tombstones) {
      db.execute(
        `INSERT OR IGNORE INTO nostr_deleted_messages
           (scope, message_id, author, deleted_at)
         VALUES (?, ?, ?, ?)`,
        [scope, messageId, author, deletedAt]
      )
    }
  })
}

/** Message id → author of the deletion, for the ids that were deleted. */
function getTombstoneAuthors(
  scope: string,
  messageIds: string[]
): Map<string, string> {
  const db = getDb()
  const rows = chunk(messageIds, NOSTR_PROCESSED_EVENTS_QUERY_CHUNK).flatMap(
    (idsChunk) =>
      db.execute<{ author: string; message_id: string }>(
        `SELECT message_id, author FROM nostr_deleted_messages
         WHERE scope = ? AND message_id IN (${idsChunk.map(() => '?').join(', ')})`,
        [scope, ...idsChunk]
      ).rows._array
  )
  return new Map(rows.map((row) => [row.message_id, row.author]))
}

/** Wrap ids and tombstones of one scope, or of every scope. */
function clearMessageState(scope?: string): void {
  const db = getDb()
  if (scope) {
    db.execute('DELETE FROM nostr_message_wraps WHERE scope = ?', [scope])
    db.execute('DELETE FROM nostr_deleted_messages WHERE scope = ?', [scope])
    return
  }
  db.execute('DELETE FROM nostr_message_wraps')
  db.execute('DELETE FROM nostr_deleted_messages')
}

export {
  clearMessageState,
  deleteMessageWraps,
  getMessageWraps,
  getTombstoneAuthors,
  recordMessageWraps,
  tombstoneMessages
}
export type { NostrMessageTombstone, NostrMessageWrap }
