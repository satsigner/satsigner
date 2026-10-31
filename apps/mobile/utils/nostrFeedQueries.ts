import * as nostrKinds from 'nostr-tools/kinds'

import { type NostrAPI } from '@/api/nostr'
import {
  NOSTR_BOOKMARKS_MAX_FETCH,
  NOSTR_FEED_PAGE_SIZE,
  NOSTR_NOTE_FILTER_OPTIONS
} from '@/constants/nostr'
import type {
  NostrDataSource,
  NostrErrorCode,
  NostrFeedNoteLike,
  NostrFetchResult,
  NostrParsedBookmark,
  ZapReceiptInfo
} from '@/types/models/Nostr'
import { getSecretFromNsec } from '@/utils/nostr'
import {
  decryptPrivateBookmarks,
  mergeBookmarks,
  parsePublicBookmarks
} from '@/utils/nostrBookmarks'
import { getNostrErrorCode } from '@/utils/nostrErrorMessage'
import { flattenFeedPages, getNextFeedPageParam } from '@/utils/nostrFeed'
import { collectUnresolvedEventIds } from '@/utils/nostrNoteQuotes'
import { mergeZapReceiptsById } from '@/utils/nostrZap'

/** Infinite queries start at 0, meaning "no `until`": the newest page. */
const FEED_HEAD_PAGE_PARAM = 0

/** A page of notes plus the quoted/reposted events they reference. */
type NostrFeedNotesPage = NostrFetchResult<NostrFeedNoteLike[]> & {
  resolved: Map<string, NostrFeedNoteLike>
}

type NostrBookmarkNotes = NostrFeedNotesPage & {
  privateIds: Set<string>
}

type NotesPageQuery = {
  kinds: number[]
  resolveQuotes: boolean
  since?: number
  until?: number
}

type BookmarksQuery = {
  filterId: string
  hexPubkey: string
  npub: string
  nsec?: string
  resolveQuotes: boolean
}

function kindsForNoteKindFilterId(id: string): number[] {
  const option = NOSTR_NOTE_FILTER_OPTIONS.find((o) => o.id === id)
  return option?.kinds.length ? option.kinds : [nostrKinds.ShortTextNote]
}

async function resolveReferencedNotes(
  api: NostrAPI,
  notes: NostrFeedNoteLike[],
  enabled: boolean
): Promise<Map<string, NostrFeedNoteLike>> {
  const ids = enabled ? collectUnresolvedEventIds(notes, new Set()) : []
  if (ids.length === 0) {
    return new Map()
  }
  const { data } = await api.fetchEventBatch(ids)
  return data
}

async function fetchOwnNotesPage(
  api: NostrAPI,
  npub: string,
  { kinds, resolveQuotes, since, until }: NotesPageQuery
): Promise<NostrFeedNotesPage> {
  const result = await api.fetchNotes(npub, {
    kinds,
    limit: NOSTR_FEED_PAGE_SIZE,
    since,
    until
  })
  const resolved = await resolveReferencedNotes(api, result.data, resolveQuotes)
  return { ...result, resolved }
}

async function fetchFollowingFeedPage(
  api: NostrAPI,
  authors: string[],
  { kinds, resolveQuotes, since, until }: NotesPageQuery
): Promise<NostrFeedNotesPage> {
  const result = await api.fetchFollowingTimelineNotes(authors, {
    kinds,
    limit: NOSTR_FEED_PAGE_SIZE,
    since,
    until
  })
  const resolved = await resolveReferencedNotes(api, result.data, resolveQuotes)
  return { ...result, resolved }
}

function getBookmarkEntries(
  list: { content: string; tags: string[][] },
  { filterId, hexPubkey, nsec }: BookmarksQuery
): NostrParsedBookmark[] {
  const secretKey = nsec ? getSecretFromNsec(nsec) : null
  const privateEntries =
    filterId !== 'bookmarks' && secretKey
      ? decryptPrivateBookmarks(list.content, secretKey, hexPubkey)
      : []
  const entries =
    filterId === 'private_bookmarks'
      ? privateEntries
      : mergeBookmarks(parsePublicBookmarks(list.tags), privateEntries)
  return entries.slice(0, NOSTR_BOOKMARKS_MAX_FETCH)
}

/**
 * The identity's NIP-51 bookmarks (public, private or both) resolved to
 * notes in one batched lookup. The bookmark list itself is not cached, so a
 * relay failure yields an empty list flagged with the error.
 */
async function fetchBookmarkNotes(
  api: NostrAPI,
  query: BookmarksQuery
): Promise<NostrBookmarkNotes> {
  const empty = { privateIds: new Set<string>(), resolved: new Map() }
  try {
    const list = await api.fetchBookmarks(query.npub)
    if (!list) {
      return { ...empty, data: [], source: 'relay' }
    }
    const entries = getBookmarkEntries(list, query)
    const batch = await api.fetchEventBatch(entries.map((e) => e.eventId))
    const notes = entries.flatMap((entry) => {
      const note = batch.data.get(entry.eventId)
      return note ? [note] : []
    })
    const resolved = await resolveReferencedNotes(
      api,
      notes,
      query.resolveQuotes
    )
    return {
      data: notes,
      error: batch.error,
      privateIds: new Set(
        entries.filter((e) => e.source === 'private').map((e) => e.eventId)
      ),
      resolved,
      source: batch.source
    }
  } catch (error) {
    return {
      ...empty,
      data: [],
      error: getNostrErrorCode(error),
      source: 'cache'
    }
  }
}

type NostrFeedPagesSummary = {
  error?: NostrErrorCode
  notes: NostrFeedNoteLike[]
  resolved: Map<string, NostrFeedNoteLike>
  source: NostrDataSource
}

/** Flattens loaded pages; the list is only as fresh as its least fresh page. */
function summarizeFeedPages(
  pages: NostrFeedNotesPage[]
): NostrFeedPagesSummary {
  const degraded = pages.find((page) => page.source !== 'relay' || page.error)
  return {
    error: degraded?.error,
    notes: flattenFeedPages(pages.map((page) => page.data)),
    resolved: new Map(pages.flatMap((page) => [...page.resolved])),
    source: degraded?.source ?? 'relay'
  }
}

function getNextNotesPageParam(
  pages: NostrFeedNotesPage[],
  lastPageParam: number
): number | undefined {
  return getNextFeedPageParam(
    pages.map((page) => page.data),
    lastPageParam === FEED_HEAD_PAGE_PARAM ? undefined : lastPageParam
  )
}

type NostrZapPagesSummary = {
  error?: NostrErrorCode
  source: NostrDataSource
  zaps: ZapReceiptInfo[]
}

function toPagingItem(zap: ZapReceiptInfo) {
  return { created_at: zap.createdAt, id: zap.id }
}

/** Receipts across pages, deduped and sorted newest first once at fetch time. */
function summarizeZapPages(
  pages: NostrFetchResult<ZapReceiptInfo[]>[]
): NostrZapPagesSummary {
  const degraded = pages.find((page) => page.source !== 'relay' || page.error)
  const ids = new Set(
    flattenFeedPages(pages.map((page) => page.data.map(toPagingItem))).map(
      (item) => item.id
    )
  )
  return {
    error: degraded?.error,
    source: degraded?.source ?? 'relay',
    zaps: mergeZapReceiptsById(pages.flatMap((page) => page.data)).filter(
      (zap) => ids.has(zap.id)
    )
  }
}

function getNextZapsPageParam(
  pages: NostrFetchResult<ZapReceiptInfo[]>[],
  lastPageParam: number | undefined
): number | undefined {
  return getNextFeedPageParam(
    pages.map((page) => page.data.map(toPagingItem)),
    lastPageParam
  )
}

export {
  FEED_HEAD_PAGE_PARAM,
  getNextZapsPageParam,
  summarizeZapPages,
  fetchBookmarkNotes,
  fetchFollowingFeedPage,
  fetchOwnNotesPage,
  getNextNotesPageParam,
  kindsForNoteKindFilterId,
  summarizeFeedPages
}
export type {
  NostrBookmarkNotes,
  NostrFeedNotesPage,
  NostrFeedPagesSummary,
  NostrZapPagesSummary
}
