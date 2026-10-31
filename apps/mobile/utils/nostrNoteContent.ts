import * as nostrKinds from 'nostr-tools/kinds'

import {
  NOSTR_NOTE_CONTENT_CACHE_MAX_ENTRIES,
  NOSTR_NOTE_QUOTE_MAX_IMAGES,
  NOSTR_NOTE_ROW_MAX_IMAGES,
  NOSTR_NOTE_ROW_MAX_VIDEOS
} from '@/constants/nostr'
import type { NostrFeedNoteLike, NostrVideoEmbed } from '@/types/models/Nostr'
import {
  extractImageUrlsFromNote,
  stripImageUrlsFromContent
} from '@/utils/nostrNoteMedia'
import { extractMentionPubkeys } from '@/utils/nostrNoteMentions'
import {
  getQuoteTagEventIds,
  getResolvedEventId,
  hasEmbeddedEventRef,
  parseRepostOriginalEvent,
  stripNostrEventRefs
} from '@/utils/nostrNoteQuotes'
import { extractVideoEmbedsFromNote } from '@/utils/nostrNoteVideoUrls'

type ParsedNoteContent = {
  /** The note whose body is shown: the original for reposts, else the note. */
  contentNote: NostrFeedNoteLike
  imageUrls: string[]
  isQuotePost: boolean
  isRepost: boolean
  mentionPubkeys: string[]
  quotedId: string | null
  repostUnavailable: boolean
  /** Body text with inline image URLs (and quote refs) removed. */
  text: string
  videoEmbeds: NostrVideoEmbed[]
}

type ParsedQuoteContent = {
  imageUrls: string[]
  mentionPubkeys: string[]
  text: string
}

const noteCache = new Map<string, ParsedNoteContent>()
const quoteCache = new Map<string, ParsedQuoteContent>()

function remember<T>(cache: Map<string, T>, key: string, value: T): T {
  if (cache.size >= NOSTR_NOTE_CONTENT_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (!oldest.done) {
      cache.delete(oldest.value)
    }
  }
  cache.set(key, value)
  return value
}

function isRepostKind(kind: number): boolean {
  return kind === nostrKinds.Repost || kind === nostrKinds.GenericRepost
}

function computeNoteContent(
  note: NostrFeedNoteLike,
  resolvedQuotedNote?: NostrFeedNoteLike
): ParsedNoteContent {
  const isRepost = isRepostKind(note.kind)
  const repostOriginal = isRepost
    ? (parseRepostOriginalEvent(note.content) ?? resolvedQuotedNote ?? null)
    : null
  const repostUnavailable = isRepost && repostOriginal === null
  const isQuotePost =
    note.kind === nostrKinds.ShortTextNote &&
    (getQuoteTagEventIds(note.tags).length > 0 ||
      hasEmbeddedEventRef(note.content))
  const contentNote = repostOriginal ?? note

  const imageUrls = repostUnavailable
    ? []
    : extractImageUrlsFromNote(contentNote.content, contentNote.tags).slice(
        0,
        NOSTR_NOTE_ROW_MAX_IMAGES
      )
  const videoEmbeds = repostUnavailable
    ? []
    : extractVideoEmbedsFromNote(contentNote.content, contentNote.tags).slice(
        0,
        NOSTR_NOTE_ROW_MAX_VIDEOS
      )
  const text = stripImageUrlsFromContent(
    isQuotePost ? stripNostrEventRefs(note.content) : contentNote.content,
    imageUrls
  )

  return {
    contentNote,
    imageUrls,
    isQuotePost,
    isRepost,
    mentionPubkeys: extractMentionPubkeys(text),
    quotedId: isQuotePost ? getResolvedEventId(note) : null,
    repostUnavailable,
    text,
    videoEmbeds
  }
}

/**
 * Media, text and mentions of a feed note, parsed once per note id (and
 * resolved repost) and kept in a bounded cache so scrolling never re-parses.
 */
function parseNoteContent(
  note: NostrFeedNoteLike,
  resolvedQuotedNote?: NostrFeedNoteLike
): ParsedNoteContent {
  if (!note.id) {
    return computeNoteContent(note, resolvedQuotedNote)
  }
  const key = `${note.id}:${resolvedQuotedNote?.id ?? ''}`
  return (
    noteCache.get(key) ??
    remember(noteCache, key, computeNoteContent(note, resolvedQuotedNote))
  )
}

function computeQuoteContent(note: NostrFeedNoteLike): ParsedQuoteContent {
  const imageUrls = extractImageUrlsFromNote(note.content, note.tags).slice(
    0,
    NOSTR_NOTE_QUOTE_MAX_IMAGES
  )
  const text = stripImageUrlsFromContent(note.content, imageUrls)
  return { imageUrls, mentionPubkeys: extractMentionPubkeys(text), text }
}

/** Inline quote card content, cached by note id like {@link parseNoteContent}. */
function parseQuoteContent(note: NostrFeedNoteLike): ParsedQuoteContent {
  if (!note.id) {
    return computeQuoteContent(note)
  }
  return (
    quoteCache.get(note.id) ??
    remember(quoteCache, note.id, computeQuoteContent(note))
  )
}

/** The quoted or reposted event a note points at, when it was resolved. */
function getResolvedQuotedNote(
  note: NostrFeedNoteLike,
  resolved: Map<string, NostrFeedNoteLike>
): NostrFeedNoteLike | undefined {
  const resolvedId = getResolvedEventId(note)
  return resolvedId ? resolved.get(resolvedId) : undefined
}

/** Pubkeys a note row shows: author, mentions, and the quoted note's author. */
function getNoteProfilePubkeys(
  note: NostrFeedNoteLike,
  quoted?: NostrFeedNoteLike
): string[] {
  const { mentionPubkeys } = parseNoteContent(note, quoted)
  const quotedPubkeys = quoted
    ? [quoted.pubkey, ...parseQuoteContent(quoted).mentionPubkeys]
    : []
  return [note.pubkey, ...mentionPubkeys, ...quotedPubkeys].map((pk) =>
    pk.toLowerCase()
  )
}

function clearNoteContentCache(): void {
  noteCache.clear()
  quoteCache.clear()
}

export {
  clearNoteContentCache,
  getNoteProfilePubkeys,
  getResolvedQuotedNote,
  parseNoteContent,
  parseQuoteContent
}
export type { ParsedNoteContent }
