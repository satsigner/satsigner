import {
  NOSTR_EVENT_ID_RE,
  NOSTR_FEED_MAX_EMPTY_PAGES,
  NOSTR_FEED_WINDOW_MAX_ITEMS,
  NOSTR_HEX_PUBKEY_RE
} from '@/constants/nostr'
import type { CachedEvent } from '@/db/nostrCache'
import type { NostrFeedNoteLike } from '@/types/models/Nostr'
import { NostrNoRelaysError, NostrRelayTimeoutError } from '@/utils/errors'
import { isNoteQuotePost } from '@/utils/nostrNoteQuotes'
import { noteLooksLikeReply } from '@/utils/nostrNoteThread'

type FeedPageItem = { created_at: number; id: string }

function cachedEventToNote(cached: CachedEvent): NostrFeedNoteLike {
  return {
    content: cached.content,
    created_at: cached.created_at,
    id: cached.event_id,
    kind: cached.kind,
    pubkey: cached.pubkey,
    tags: cached.tags
  }
}

/** Relay results win over cached copies of the same id; newest first. */
function mergeNotesNewestFirst(
  fresh: NostrFeedNoteLike[],
  cached: NostrFeedNoteLike[],
  limit: number
): NostrFeedNoteLike[] {
  const freshIds = new Set(fresh.map((note) => note.id))
  return [...fresh, ...cached.filter((note) => !freshIds.has(note.id))]
    .toSorted((a, b) => b.created_at - a.created_at)
    .slice(0, limit)
}

/** Event ids referenced by the author's own kind 5 deletion requests (NIP-09). */
function getDeletedEventIds(
  deletions: { pubkey: string; tags: (string | undefined)[][] }[],
  authorPubkey: string
): Set<string> {
  const author = authorPubkey.toLowerCase()
  const ids = deletions
    .filter((deletion) => deletion.pubkey.toLowerCase() === author)
    .flatMap((deletion) => deletion.tags)
    .flatMap((tag) =>
      tag[0] === 'e' && typeof tag[1] === 'string' ? [tag[1]] : []
    )
    .filter((id) => NOSTR_EVENT_ID_RE.test(id))
  return new Set(ids)
}

/** Followed pubkeys from kind 3 p tags, in order, lowercase, no dupes or self. */
function getFollowedPubkeysFromTags(
  tags: (string | undefined)[][],
  selfPubkey: string
): string[] {
  const self = selfPubkey.toLowerCase()
  const pubkeys = tags
    .flatMap((tag) =>
      tag[0] === 'p' && typeof tag[1] === 'string' ? [tag[1].toLowerCase()] : []
    )
    .filter((pk) => NOSTR_HEX_PUBKEY_RE.test(pk) && pk !== self)
  return [...new Set(pubkeys)]
}

/** Hides replies (but keeps quote posts) when the kind 1 filter asks for it. */
function filterFeedReplies(
  notes: NostrFeedNoteLike[],
  excludeReplies: boolean
): NostrFeedNoteLike[] {
  if (!excludeReplies) {
    return notes
  }
  return notes.filter(
    (note) => !noteLooksLikeReply(note.tags) || isNoteQuotePost(note)
  )
}

function isNostrRelayUnavailableError(error: unknown): boolean {
  return (
    error instanceof NostrNoRelaysError ||
    error instanceof NostrRelayTimeoutError
  )
}

/** Unique items across pages in page order, capped at the feed window. */
function flattenFeedPages<T extends FeedPageItem>(pages: T[][]): T[] {
  const seen = new Set<string>()
  const items: T[] = []
  for (const item of pages.flat()) {
    if (items.length >= NOSTR_FEED_WINDOW_MAX_ITEMS) {
      break
    }
    if (seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    items.push(item)
  }
  return items
}

function countTrailingEmptyPages<T extends FeedPageItem>(pages: T[][]): number {
  const seen = new Set<string>()
  const newPerPage = pages.map((page) => {
    const fresh = page.filter((item) => !seen.has(item.id))
    for (const item of fresh) {
      seen.add(item.id)
    }
    return fresh.length
  })
  const lastNonEmpty = newPerPage.findLastIndex((count) => count > 0)
  return newPerPage.length - 1 - lastNonEmpty
}

/**
 * `until` for the next page: the oldest timestamp seen so far, stepped back
 * one second when it would repeat the previous boundary. Paging stops once
 * the window is full, a page comes back empty, or several pages in a row
 * added nothing new.
 */
function getNextFeedPageParam<T extends FeedPageItem>(
  pages: T[][],
  lastPageParam: number | undefined
): number | undefined {
  const lastPage = pages.at(-1)
  if (!lastPage || lastPage.length === 0) {
    return undefined
  }
  if (flattenFeedPages(pages).length >= NOSTR_FEED_WINDOW_MAX_ITEMS) {
    return undefined
  }
  if (countTrailingEmptyPages(pages) >= NOSTR_FEED_MAX_EMPTY_PAGES) {
    return undefined
  }
  const oldest = Math.min(...lastPage.map((item) => item.created_at))
  if (lastPageParam !== undefined && oldest >= lastPageParam) {
    return lastPageParam - 1
  }
  return oldest
}

export {
  cachedEventToNote,
  filterFeedReplies,
  flattenFeedPages,
  getDeletedEventIds,
  getFollowedPubkeysFromTags,
  getNextFeedPageParam,
  isNostrRelayUnavailableError,
  mergeNotesNewestFirst
}
