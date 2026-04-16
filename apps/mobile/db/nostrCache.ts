import { type NitroSQLiteConnection } from 'react-native-nitro-sqlite'

import {
  EVENT_CACHE_MAX_ROWS,
  OTHER_EVENT_CACHE_MAX_AGE_SECS,
  PROFILE_CACHE_MAX_AGE_SECS
} from '@/constants/nostr'
import type { NostrKind0Profile } from '@/types/models/Nostr'

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

function nowUnix(): number {
  return Math.floor(Date.now() / 1000)
}

function parseTagsJson(raw: unknown): string[][] {
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as string[][]) : []
  } catch {
    return []
  }
}

function rowToCachedEvent(row: Record<string, unknown>): CachedEvent {
  return {
    content: row.content as string,
    created_at: row.created_at as number,
    event_id: row.event_id as string,
    is_own: row.is_own as number,
    kind: row.kind as number,
    pubkey: row.pubkey as string,
    tags: parseTagsJson(row.tags_json)
  }
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
  if (events.length === 0) return
  const db = safeGetDb()
  if (!db) return
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
  if (!db) return []
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
    const { results } = db.execute(sql, params)
    return (results ?? []).map((r) =>
      rowToCachedEvent(r as Record<string, unknown>)
    )
  } catch {
    return []
  }
}

export function getCachedEvent(eventId: string): CachedEvent | null {
  const db = safeGetDb()
  if (!db) return null
  try {
    const { results } = db.execute(
      'SELECT * FROM nostr_event_cache WHERE event_id = ? LIMIT 1',
      [eventId]
    )
    if (!results || results.length === 0) return null
    return rowToCachedEvent(results[0] as Record<string, unknown>)
  } catch {
    return null
  }
}

export function getCachedZapReceipts(eventIdHex: string): CachedEvent[] {
  const db = safeGetDb()
  if (!db) return []
  try {
    const { results } = db.execute(
      `SELECT * FROM nostr_event_cache
       WHERE kind = 9735
       ORDER BY created_at DESC`,
      []
    )
    if (!results) return []
    return (results as Record<string, unknown>[])
      .map(rowToCachedEvent)
      .filter((e) => {
        return e.tags.some(
          (tag) => tag[0] === 'e' && tag[1] === eventIdHex
        )
      })
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
  if (!db) return []
  try {
    const pk = pubkey.toLowerCase()
    const sql = until
      ? `SELECT * FROM nostr_event_cache
         WHERE kind = 9735 AND created_at < ?
         ORDER BY created_at DESC`
      : `SELECT * FROM nostr_event_cache
         WHERE kind = 9735
         ORDER BY created_at DESC`
    const params = until ? [until] : []
    const { results } = db.execute(sql, params)
    if (!results) return []
    return (results as Record<string, unknown>[])
      .map(rowToCachedEvent)
      .filter((e) => {
        return e.tags.some(
          (tag) => tag[0] === 'p' && tag[1]?.toLowerCase() === pk
        )
      })
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
  if (!db) return null
  try {
    const sql = pubkey
      ? `SELECT MAX(created_at) as max_ts FROM nostr_event_cache
         WHERE kind = ? AND pubkey = ?`
      : `SELECT MAX(created_at) as max_ts FROM nostr_event_cache
         WHERE kind = ?`
    const params = pubkey ? [kind, pubkey.toLowerCase()] : [kind]
    const { results } = db.execute(sql, params)
    if (!results || results.length === 0) return null
    const val = (results[0] as Record<string, unknown>).max_ts
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
  if (!db) return
  try {
    const now = nowUnix()
    db.execute(
      `INSERT OR REPLACE INTO nostr_profile_cache
       (pubkey, display_name, picture, nip05, lud16, event_id, created_at, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pubkey.toLowerCase(),
        profile.displayName ?? null,
        profile.picture ?? null,
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
  if (!db) return null
  try {
    const { results } = db.execute(
      'SELECT * FROM nostr_profile_cache WHERE pubkey = ? LIMIT 1',
      [pubkey.toLowerCase()]
    )
    if (!results || results.length === 0) return null
    const r = results[0] as Record<string, unknown>
    return {
      cached_at: r.cached_at as number,
      created_at: r.created_at as number,
      displayName: (r.display_name as string) ?? undefined,
      event_id: (r.event_id as string) ?? undefined,
      lud16: (r.lud16 as string) ?? undefined,
      nip05: (r.nip05 as string) ?? undefined,
      picture: (r.picture as string) ?? undefined,
      pubkey: r.pubkey as string
    }
  } catch {
    return null
  }
}

export function pruneCache(): void {
  const db = safeGetDb()
  if (!db) return
  try {
    const now = nowUnix()

    db.execute(
      'DELETE FROM nostr_event_cache WHERE is_own = 0 AND cached_at < ?',
      [now - OTHER_EVENT_CACHE_MAX_AGE_SECS]
    )

    db.execute('DELETE FROM nostr_profile_cache WHERE cached_at < ?', [
      now - PROFILE_CACHE_MAX_AGE_SECS
    ])

    const { results } = db.execute(
      'SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 0',
      []
    )
    const count = (results?.[0] as Record<string, unknown>)?.cnt as number
    if (count > EVENT_CACHE_MAX_ROWS) {
      const excess = count - EVENT_CACHE_MAX_ROWS
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
  const empty = { feedNotes: 0, ownNotes: 0, ownZaps: 0, profiles: 0, zapReceipts: 0 }
  const db = safeGetDb()
  if (!db) return empty
  try {
    const pk = ownPubkeyHex.toLowerCase()

    const ownNotesRes = db.execute(
      'SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 1 AND kind = 1 AND pubkey = ?',
      [pk]
    )
    const ownNotes =
      ((ownNotesRes.results?.[0] as Record<string, unknown>)?.cnt as number) ??
      0

    const ownZapsRes = db.execute(
      'SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 1 AND kind = 9735',
      []
    )
    const ownZaps =
      ((ownZapsRes.results?.[0] as Record<string, unknown>)?.cnt as number) ??
      0

    const feedRes = db.execute(
      'SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 0 AND kind = 1',
      []
    )
    const feedNotes =
      ((feedRes.results?.[0] as Record<string, unknown>)?.cnt as number) ?? 0

    const zapRes = db.execute(
      'SELECT COUNT(*) as cnt FROM nostr_event_cache WHERE is_own = 0 AND kind = 9735',
      []
    )
    const zapReceipts =
      ((zapRes.results?.[0] as Record<string, unknown>)?.cnt as number) ?? 0

    const profRes = db.execute(
      'SELECT COUNT(*) as cnt FROM nostr_profile_cache',
      []
    )
    const profiles =
      ((profRes.results?.[0] as Record<string, unknown>)?.cnt as number) ?? 0

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
  if (!db) return
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
        'DELETE FROM nostr_event_cache WHERE is_own = 1 AND kind = 9735',
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
        'DELETE FROM nostr_event_cache WHERE is_own = 0 AND kind = 9735',
        []
      )
      break
    case 'profiles':
      db.execute('DELETE FROM nostr_profile_cache', [])
      break
  }
}

export function clearAllCache(): void {
  const db = safeGetDb()
  if (!db) return
  db.execute('DELETE FROM nostr_event_cache', [])
  db.execute('DELETE FROM nostr_profile_cache', [])
}
