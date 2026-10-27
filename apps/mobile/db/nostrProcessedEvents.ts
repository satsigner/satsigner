import { NOSTR_PROCESSED_EVENTS_QUERY_CHUNK } from '@/constants/nostr'
import { chunk } from '@/utils/array'

import { getDb, runTransaction } from './connection'

type NostrProcessedEvent = { createdAt: number; id: string }

function chatProcessedScope(identityNpub: string): string {
  return `chat:${identityNpub}`
}

function markNostrEventsProcessed(
  scope: string,
  events: NostrProcessedEvent[]
): void {
  if (events.length === 0) {
    return
  }
  runTransaction((db) => {
    for (const { createdAt, id } of events) {
      db.execute(
        `INSERT OR IGNORE INTO nostr_processed_events (scope, event_id, created_at)
         VALUES (?, ?, ?)`,
        [scope, id, createdAt]
      )
    }
  })
}

function getProcessedNostrEventIds(scope: string, ids: string[]): Set<string> {
  const db = getDb()
  const found = chunk(ids, NOSTR_PROCESSED_EVENTS_QUERY_CHUNK).flatMap(
    (idsChunk) =>
      db
        .execute<{ event_id: string }>(
          `SELECT event_id FROM nostr_processed_events
           WHERE scope = ? AND event_id IN (${idsChunk.map(() => '?').join(', ')})`,
          [scope, ...idsChunk]
        )
        .rows._array.map((row) => row.event_id)
  )
  return new Set(found)
}

function isNostrEventProcessed(scope: string, id: string): boolean {
  return getProcessedNostrEventIds(scope, [id]).has(id)
}

function getNewestProcessedCreatedAt(scope: string): number | null {
  const row = getDb()
    .execute<{ newest: number | null }>(
      'SELECT MAX(created_at) AS newest FROM nostr_processed_events WHERE scope = ?',
      [scope]
    )
    .rows.item(0)
  return row?.newest ?? null
}

function countNostrProcessedEvents(scope?: string): number {
  const result = scope
    ? getDb().execute<{ n: number }>(
        'SELECT COUNT(*) AS n FROM nostr_processed_events WHERE scope = ?',
        [scope]
      )
    : getDb().execute<{ n: number }>(
        'SELECT COUNT(*) AS n FROM nostr_processed_events'
      )
  return result.rows.item(0)?.n ?? 0
}

function pruneNostrProcessedEvents(scope: string, olderThan: number): void {
  getDb().execute(
    'DELETE FROM nostr_processed_events WHERE scope = ? AND created_at < ?',
    [scope, olderThan]
  )
}

function clearNostrProcessedEvents(scope?: string): void {
  if (scope) {
    getDb().execute('DELETE FROM nostr_processed_events WHERE scope = ?', [
      scope
    ])
    return
  }
  getDb().execute('DELETE FROM nostr_processed_events')
}

export {
  chatProcessedScope,
  clearNostrProcessedEvents,
  countNostrProcessedEvents,
  getNewestProcessedCreatedAt,
  getProcessedNostrEventIds,
  isNostrEventProcessed,
  markNostrEventsProcessed,
  pruneNostrProcessedEvents
}
export type { NostrProcessedEvent }
