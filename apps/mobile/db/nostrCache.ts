import {
  type NitroSQLiteConnection,
  type SQLiteValue
} from 'react-native-nitro-sqlite'

import {
  NOSTR_EVENT_CACHE_MAX_ROWS,
  NOSTR_EVENT_CACHE_MAX_AGE,
  NOSTR_KIND_ZAP_RECEIPT,
  NOSTR_PROFILE_CACHE_MAX_AGE_SECS
} from '@/constants/nostr'
import type { NostrKind0Profile } from '@/types/models/Nostr'
import { isStringArray } from '@/utils/array'

import { getDb, runTransaction } from './connection'

/**
 * Returns the DB connection or null if the native module isn't ready yet.
 * All cache functions are non-critical — callers fall back to relay fetches.
 */
function safeGetDb(): NitroSQLiteConnection | null {
  try {
    return getDb()
  } catch {
    return null
  }
}

export type CachedEvent = {
  event_id: string
  kind: number
  pubkey: string
  content: string
  tags: string[][]
  created_at: number
  is_own: number
}

export type CachedProfile = NostrKind0Profile & {
  pubkey: string
  event_id?: string
  created_at: number
  cached_at: number
}

type CacheCounts = {
  feedNotes: number
  ownNotes: number
  ownZaps: number
  profiles: number
  zapReceipts: number
}

export type CacheCategory =
  | 'ownNotes'
  | 'ownZaps'
  | 'feedNotes'
  | 'zapReceipts'
  | 'profiles'

type CachedEventRow = {
  event_id: string
  kind: number
  pubkey: string
  content: string
  tags_json: string
  created_at: number
  cached_at: number
  is_own: number
}

type CachedProfileRow = {
  pubkey: string
  display_name: string | null
  picture: string | null
  banner: string | null
  nip05: string | null
  lud16: string | null
  event_id: string | null
  created_at: number
  cached_at: number
}

type CountRow = { cnt: number }

type NewestTimestampRow = { max_ts: number | null }

function nowUnix(): number {
  return Math.floor(Date.now() / 1000)
}

function parseTagsJson(raw: unknown): string[][] {
  if (typeof raw !== 'string') {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isStringArray) : []
  } catch {
    return []
  }
}

function rowToCachedEvent(row: CachedEventRow): CachedEvent {
  return {
    content: row.content,
    created_at: row.created_at,
    event_id: row.event_id,
    is_own: row.is_own,
    kind: row.kind,
    pubkey: row.pubkey,
    tags: parseTagsJson(row.tags_json)
  }
}

/** Runs a `SELECT COUNT(*) as cnt` query, reading a missing row as 0. */
function countRows(
  db: NitroSQLiteConnection,
  sql: string,
  params: SQLiteValue[] = []
): number {
  return db.execute<CountRow>(sql, params).rows.item(0)?.cnt ?? 0
}

export function cacheEvents(
  events: {
    id: string
    kind: number
    pubkey: string
    content: string
    tags: string[][]
    created_at: number
  }[],
  ownPubkeys: string[]
): void {
  if (events.length === 0) {
    return
  }
  const db = safeGetDb()
  if (!db) {
    return
  }
  const ownSet = new Set(ownPubkeys.map((pk) => pk.toLowerCase()))
  const now = nowUnix()

  try {
    runTransaction(() => {
      for (const e of events) {
        const isOwn = ownSet.has(e.pubkey.toLowerCase()) ? 1 : 0
        db.execute(
          `INSERT OR REPLACE INTO nostr_event_cache
           (event_id, kind, pubkey, content, tags_json, created_at, cached_at, is_own)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.id,
            e.kind,
            e.pubkey,
            e.content,
            JSON.stringify(e.tags),
            e.created_at,
            now,
            isOwn
          ]
        )
      }
    })
  } catch {
    // DB not ready — writes are best-effort
  }
}

export function getCachedNotes(
  pubkey: string,
  limit: number,
  until?: number
): CachedEvent[] {
  const db = safeGetDb()
  if (!db) {
    return []
  }
  try {
    const pk = pubkey.toLowerCase()
    const sql = until
      ? `SELECT * FROM nostr_event_cache
         WHERE kind = 1 AND pubkey = ? AND created_at < ?
         ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM nostr_event_cache
         WHERE kind = 1 AND pubkey = ?
         ORDER BY created_at DESC LIMIT ?`
    const params = until ? [pk, until, limit] : [pk, limit]
    const { rows } = db.execute<CachedEventRow>(sql, params)
    return rows._array.map((r) => rowToCachedEvent(r))
  } catch {
    return []
  }
}

export function getCachedEvent(eventId: string): CachedEvent | null {
  const db = safeGetDb()
  if (!db) {
    return null
  }
  try {
    const row = db
      .execute<CachedEventRow>(
        'SELECT * FROM nostr_event_cache WHERE event_id = ? LIMIT 1',
        [eventId]
      )
      .rows.item(0)
    if (!row) {
      return null
    }
    return rowToCachedEvent(row)
  } catch {
    return null
  }
}

export function getCachedZapReceipts(eventIdHex: string): CachedEvent[] {
  const db = safeGetDb()
  if (!db) {
    return []
  }
  try {
    const { rows } = db.execute<CachedEventRow>(
      `SELECT * FROM nostr_event_cache
       WHERE kind = ${NOSTR_KIND_ZAP_RECEIPT}
       ORDER BY created_at DESC`,
      []
    )
    return rows._array
      .map(rowToCachedEvent)
      .filter((e) =>
        e.tags.some((tag) => tag[0] === 'e' && tag[1] === eventIdHex)
      )
  } catch {
    return []
  }
}

export function getCachedZapsByPubkey(
  pubkey: string,
  limit: number,
  until?: number
): CachedEvent[] {
  const db = safeGetDb()
  if (!db) {
    return []
  }
  try {
    const pk = pubkey.toLowerCase()
    const sql = until
      ? `SELECT * FROM nostr_event_cache
         WHERE kind = ${NOSTR_KIND_ZAP_RECEIPT} AND created_at < ?
         ORDER BY created_at DESC`
      : `SELECT * FROM nostr_event_cache
         WHERE kind = ${NOSTR_KIND_ZAP_RECEIPT}
         ORDER BY created_at DESC`
    const params = until ? [until] : []
    const { rows } = db.execute<CachedEventRow>(sql, params)
    return rows._array
      .map(rowToCachedEvent)
      .filter((e) =>
        e.tags.some((tag) => tag[0] === 'p' && tag[1]?.toLowerCase() === pk)
      )
      .slice(0, limit)
  } catch {
    return []
  }
}

export function getNewestCachedTimestamp(
  kind: number,
  pubkey?: string
): number | null {
  const db = safeGetDb()
  if (!db) {
    return null
  }
  try {
    const sql = pubkey
      ? `SELECT MAX(created_at) as max_ts FROM nostr_event_cache
         WHERE kind = ? AND pubkey = ?`
      : `SELECT MAX(created_at) as max_ts FROM nostr_event_cache
         WHERE kind = ?`
    const params = pubkey ? [kind, pubkey.toLowerCase()] : [kind]
    const val = db.execute<NewestTimestampRow>(sql, params).rows.item(0)?.max_ts
    return typeof val === 'number' ? val : null
  } catch {
    return null
  }
}

export function cacheProfile(
  pubkey: string,
  profile: NostrKind0Profile,
  eventId?: string,
  createdAt?: number
): void {
  const db = safeGetDb()
  if (!db) {
    return
  }
  try {
    const now = nowUnix()
    db.execute(
      `INSERT OR REPLACE INTO nostr_profile_cache
       (pubkey, display_name, picture, banner, nip05, lud16, event_id, created_at, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pubkey.toLowerCase(),
        profile.displayName ?? null,
        profile.picture ?? null,
        profile.banner ?? null,
        profile.nip05 ?? null,
        profile.lud16 ?? null,
        eventId ?? null,
        createdAt ?? now,
        now
      ]
    )
  } catch {
    // DB not ready — writes are best-effort
  }
}

export function getCachedProfile(pubkey: string): CachedProfile | null {
  const db = safeGetDb()
  if (!db) {
    return null
  }
  try {
    const r = db
      .execute<CachedProfileRow>(
        'SELECT * FROM nostr_profile_cache WHERE pubkey = ? LIMIT 1',
        [pubkey.toLowerCase()]
      )
      .rows.item(0)
    if (!r) {
      return null
    }
    return {
      banner: r.banner ?? undefined,
      cached_at: r.cached_at,
      created_at: r.created_at,
      displayName: r.display_name ?? undefined,
      event_id: r.event_id ?? undefined,
      lud16: r.lud16 ?? undefined,
      nip05: r.nip05 ?? undefined,
      picture: r.picture ?? undefined,
      pubkey: r.pubkey
    }
  } catch {
    return null
  }
}

export function pruneCache(): void {
  const db = safeGetDb()
  if (!db) {
    return
  }
  try {
    const now = nowUnix()

    db.execute(
      'DELETE FROM nostr_event_cache WHERE is_own = 0 AND cached_at < ?',
      [now - NOSTR_EVENT_CACHE_MAX_AGE]
    )

    db.execute('DELETE FROM nostr_profile_cache WHERE cached_at < ?', [
      now - NOSTR_PROFILE_CACHE_MAX_AGE_SECS
    ])

    const count = countRows(
      db,
      'SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 0'
    )
    if (count > NOSTR_EVENT_CACHE_MAX_ROWS) {
      const excess = count - NOSTR_EVENT_CACHE_MAX_ROWS
      db.execute(
        `DELETE FROM nostr_event_cache WHERE event_id IN (
          SELECT event_id FROM nostr_event_cache
          WHERE is_own = 0
          ORDER BY cached_at ASC
          LIMIT ?
        )`,
        [excess]
      )
    }
  } catch {
    // prune is best-effort
  }
}

export function getCacheCounts(ownPubkeyHex: string): CacheCounts {
  const empty = {
    feedNotes: 0,
    ownNotes: 0,
    ownZaps: 0,
    profiles: 0,
    zapReceipts: 0
  }
  const db = safeGetDb()
  if (!db) {
    return empty
  }
  try {
    const pk = ownPubkeyHex.toLowerCase()

    const ownNotes = countRows(
      db,
      'SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 1 AND kind = 1 AND pubkey = ?',
      [pk]
    )
    const ownZaps = countRows(
      db,
      `SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 1 AND kind = ${NOSTR_KIND_ZAP_RECEIPT}`
    )
    const feedNotes = countRows(
      db,
      'SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 0 AND kind = 1'
    )
    const zapReceipts = countRows(
      db,
      `SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 0 AND kind = ${NOSTR_KIND_ZAP_RECEIPT}`
    )
    const profiles = countRows(
      db,
      'SELECT COUNT(*) as cnt FROM nostr_profile_cache'
    )

    return { feedNotes, ownNotes, ownZaps, profiles, zapReceipts }
  } catch {
    return empty
  }
}

export function clearCacheCategory(
  category: CacheCategory,
  ownPubkeyHex?: string
): void {
  const db = safeGetDb()
  if (!db) {
    return
  }
  const pk = ownPubkeyHex?.toLowerCase()

  switch (category) {
    case 'ownNotes':
      if (pk) {
        db.execute(
          'DELETE FROM nostr_event_cache WHERE is_own = 1 AND kind = 1 AND pubkey = ?',
          [pk]
        )
      }
      break
    case 'ownZaps':
      db.execute(
        `DELETE FROM nostr_event_cache WHERE is_own = 1 AND kind = ${NOSTR_KIND_ZAP_RECEIPT}`,
        []
      )
      break
    case 'feedNotes':
      db.execute(
        'DELETE FROM nostr_event_cache WHERE is_own = 0 AND kind = 1',
        []
      )
      break
    case 'zapReceipts':
      db.execute(
        `DELETE FROM nostr_event_cache WHERE is_own = 0 AND kind = ${NOSTR_KIND_ZAP_RECEIPT}`,
        []
      )
      break
    case 'profiles':
      db.execute('DELETE FROM nostr_profile_cache', [])
      break
    default:
      break
  }
}

export function clearAllCache(): void {
  const db = safeGetDb()
  if (!db) {
    return
  }
  db.execute('DELETE FROM nostr_event_cache', [])
  db.execute('DELETE FROM nostr_profile_cache', [])
}
