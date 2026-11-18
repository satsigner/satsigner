import * as nostrKinds from 'nostr-tools/kinds'

import {
  NOSTR_CHAT_REACTION_MAX_LENGTH,
  NOSTR_HEX_PUBKEY_RE
} from '@/constants/nostr'
import type {
  NostrChatReaction,
  NostrChatReactionSummary
} from '@/types/models/Nostr'

/** NIP-25 "+" is a like. */
const LIKE_CONTENT = '+'
const LIKE_EMOJI = '👍'

/** Status an agent signals by reacting to my message. */
type ChatAgentStatus = 'answered' | 'error' | 'working'

const AGENT_STATUS_BY_EMOJI = new Map<string, ChatAgentStatus>([
  ['⚠️', 'error'],
  ['✅', 'answered'],
  ['👀', 'working']
])

/**
 * The emoji a reaction rumor carries, or null when it isn't a usable one:
 * "+" reads as 👍, "-" (dislike) and empty or oversized content are dropped.
 */
function parseReactionEmoji(content: string): string | null {
  const trimmed = content.trim()
  if (trimmed === LIKE_CONTENT) {
    return LIKE_EMOJI
  }
  if (
    trimmed.length === 0 ||
    trimmed === '-' ||
    trimmed.length > NOSTR_CHAT_REACTION_MAX_LENGTH
  ) {
    return null
  }
  return trimmed
}

/**
 * NIP-25: the last `e` tag is the reacted-to event. Only valid 32-byte hex
 * ids count, so a malformed tag can't attach a reaction to anything.
 */
function getReactionTargetId(tags: unknown): string | null {
  if (!Array.isArray(tags)) {
    return null
  }
  const eventTags = tags.filter(
    (tag): tag is string[] =>
      Array.isArray(tag) &&
      tag[0] === 'e' &&
      typeof tag[1] === 'string' &&
      NOSTR_HEX_PUBKEY_RE.test(tag[1])
  )
  return eventTags.at(-1)?.[1] ?? null
}

/** Tags for a reaction rumor to a chat message (peer `p` is added by the wrapper). */
function buildChatReactionTags(messageId: string): string[][] {
  return [
    ['e', messageId],
    ['k', String(nostrKinds.PrivateDirectMessage)]
  ]
}

/**
 * Groups one message's reactions by emoji: one per author and emoji, so a
 * relay replaying the same reaction (or a client sending it twice) counts once.
 * Emojis are ordered by first use.
 */
function summarizeChatReactions(
  reactions: NostrChatReaction[],
  ownHex: string | null
): NostrChatReactionSummary[] {
  const byEmoji = new Map<
    string,
    { authors: Set<string>; firstAt: number; ownReactionId?: string }
  >()
  for (const reaction of reactions) {
    const entry = byEmoji.get(reaction.emoji) ?? {
      authors: new Set<string>(),
      firstAt: reaction.created_at
    }
    entry.authors.add(reaction.author)
    entry.firstAt = Math.min(entry.firstAt, reaction.created_at)
    if (reaction.author === ownHex) {
      entry.ownReactionId = reaction.id
    }
    byEmoji.set(reaction.emoji, entry)
  }
  return [...byEmoji.entries()]
    .toSorted(([, a], [, b]) => a.firstAt - b.firstAt)
    .map(([emoji, { authors, ownReactionId }]) => ({
      count: authors.size,
      emoji,
      ...(ownReactionId ? { ownReactionId } : {})
    }))
}

/**
 * The newest status the peer signalled on one of my messages (👀 working,
 * ✅ answered, ⚠️ error), or null when they sent none.
 */
function getChatAgentStatus(
  reactions: NostrChatReaction[],
  peerHex: string
): ChatAgentStatus | null {
  const [newest] = reactions
    .filter(
      (reaction) =>
        reaction.author === peerHex && AGENT_STATUS_BY_EMOJI.has(reaction.emoji)
    )
    .toSorted((a, b) => b.created_at - a.created_at)
  return newest ? (AGENT_STATUS_BY_EMOJI.get(newest.emoji) ?? null) : null
}

/** Reactions grouped by the message they target. */
function groupReactionsByMessage(
  reactions: NostrChatReaction[]
): Map<string, NostrChatReaction[]> {
  const grouped = new Map<string, NostrChatReaction[]>()
  for (const reaction of reactions) {
    const list = grouped.get(reaction.messageId) ?? []
    list.push(reaction)
    grouped.set(reaction.messageId, list)
  }
  return grouped
}

export {
  buildChatReactionTags,
  getChatAgentStatus,
  getReactionTargetId,
  groupReactionsByMessage,
  parseReactionEmoji,
  summarizeChatReactions
}
export type { ChatAgentStatus }
