import { nip19 } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import {
  type NostrEngagementDeletion,
  type NostrKind0Profile,
  type NostrReaction,
  type NostrReactionEvent,
  type NostrReactionItem,
  type NostrReactionRow,
  type NostrReactionsPage,
  type NostrReactionSummaryEntry
} from '@/types/models/Nostr'
import { formatNpub } from '@/utils/format'
import {
  dropDeletedEngagement,
  getLatestReactionByPubkey,
  NOSTR_LIKE_CONTENT,
  type RawEngagementEvent,
  toEngagementEvent
} from '@/utils/nostrEngagement'

const NOSTR_DISLIKE_CONTENT = '-'
const NIP30_EMOJI_TAG = 'emoji'
const NIP30_SHORTCODE_PATTERN = /^:([\w-]+):$/
const CUSTOM_EMOJI_URL_PREFIX = 'https://'

const LIKE_REACTION: NostrReaction = { key: 'like', type: 'like' }
const DISLIKE_REACTION: NostrReaction = { key: 'dislike', type: 'dislike' }

function findCustomEmojiUrl(
  tags: string[][],
  shortcode: string
): string | undefined {
  const url = tags.find(
    (tag) => tag[0] === NIP30_EMOJI_TAG && tag[1] === shortcode
  )?.[2]
  return url?.startsWith(CUSTOM_EMOJI_URL_PREFIX) ? url : undefined
}

// NIP-25: "+" or empty is a like, "-" a dislike, anything else an emoji.
// NIP-30: ":shortcode:" with a matching `emoji` tag is a custom image emoji.
function normalizeReaction(
  event: Pick<NostrReactionEvent, 'content' | 'tags'>
): NostrReaction {
  const content = event.content.trim()
  if (content === '' || content === NOSTR_LIKE_CONTENT) {
    return LIKE_REACTION
  }
  if (content === NOSTR_DISLIKE_CONTENT) {
    return DISLIKE_REACTION
  }
  const shortcode = NIP30_SHORTCODE_PATTERN.exec(content)?.[1]
  const url = shortcode ? findCustomEmojiUrl(event.tags, shortcode) : undefined
  if (shortcode && url) {
    return {
      key: `custom:${shortcode}:${url}`,
      shortcode,
      type: 'customEmoji',
      url
    }
  }
  return { content, key: `emoji:${content}`, type: 'emoji' }
}

/** Latest reaction per author, newest first. */
function dedupeReactionsByAuthor<T extends NostrReactionEvent>(
  events: T[]
): T[] {
  return getLatestReactionByPubkey(events).toSorted(
    (a, b) => b.created_at - a.created_at
  )
}

function toReactionItems(events: NostrReactionEvent[]): NostrReactionItem[] {
  return dedupeReactionsByAuthor(events).map((event) => ({
    authorPubkey: event.pubkey,
    createdAt: event.created_at,
    id: event.id,
    reaction: normalizeReaction(event)
  }))
}

/** Count per reaction, most used first. */
function summarizeReactions(
  reactions: NostrReaction[]
): NostrReactionSummaryEntry[] {
  const byKey = new Map<string, NostrReactionSummaryEntry>()
  for (const reaction of reactions) {
    const count = byKey.get(reaction.key)?.count ?? 0
    byKey.set(reaction.key, { count: count + 1, reaction })
  }
  return [...byKey.values()].toSorted((a, b) => b.count - a.count)
}

/**
 * Keeps kind 7 events whose target (last `e` tag) is the note, minus those
 * their own author deleted.
 */
function buildReactionsPage(
  noteId: string,
  rawEvents: RawEngagementEvent[],
  deletions: NostrEngagementDeletion[]
): NostrReactionsPage {
  const reactions = rawEvents.flatMap((event) => {
    const parsed = toEngagementEvent(event)
    if (
      !parsed ||
      parsed.kind !== nostrKinds.Reaction ||
      parsed.targetId !== noteId
    ) {
      return []
    }
    return [{ ...parsed, tags: event.tags }]
  })
  const oldestCreatedAt =
    rawEvents.length === 0
      ? null
      : Math.min(...rawEvents.map((event) => event.created_at))
  return {
    fetchedCount: rawEvents.length,
    oldestCreatedAt,
    reactions: dropDeletedEngagement(reactions, deletions)
  }
}

/** The `until` for the next older page, or undefined when relays ran dry. */
function getNextReactionsUntil(
  page: NostrReactionsPage,
  limit: number
): number | undefined {
  if (page.fetchedCount < limit || page.oldestCreatedAt === null) {
    return undefined
  }
  return page.oldestCreatedAt - 1
}

function toReactionRow(
  item: NostrReactionItem,
  profile: NostrKind0Profile | null | undefined
): NostrReactionRow {
  const authorNpub = nip19.npubEncode(item.authorPubkey)
  return {
    ...item,
    authorLabel: profile?.displayName || formatNpub(authorNpub, 'xs'),
    authorNpub,
    authorPicture: profile?.picture
  }
}

export {
  buildReactionsPage,
  dedupeReactionsByAuthor,
  getNextReactionsUntil,
  normalizeReaction,
  summarizeReactions,
  toReactionItems,
  toReactionRow
}
