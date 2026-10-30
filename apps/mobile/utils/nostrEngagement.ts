import * as nostrKinds from 'nostr-tools/kinds'

import {
  type NostrEngagementDeletion,
  type NostrEngagementEvent,
  type NostrFeedNoteLike,
  type NostrNoteEngagement
} from '@/types/models/Nostr'

type EngagementTarget = Pick<NostrFeedNoteLike, 'id' | 'kind' | 'pubkey'>

type RawEngagementEvent = Omit<NostrEngagementEvent, 'targetId'> & {
  tags: string[][]
}

const NOSTR_LIKE_CONTENT = '+'

const NOSTR_ENGAGEMENT_KINDS = [
  nostrKinds.Reaction,
  nostrKinds.Repost,
  nostrKinds.GenericRepost
]

const EMPTY_ENGAGEMENT: NostrNoteEngagement = {
  likeCount: 0,
  ownLikeIds: [],
  ownRepostIds: [],
  repostCount: 0
}

function isRepostKind(kind: number): boolean {
  return kind === nostrKinds.Repost || kind === nostrKinds.GenericRepost
}

// NIP-25: "+" and empty content are likes; "-" and emoji are not.
function isLike(event: Pick<NostrEngagementEvent, 'content' | 'kind'>) {
  return (
    event.kind === nostrKinds.Reaction &&
    (event.content === NOSTR_LIKE_CONTENT || event.content.length === 0)
  )
}

// NIP-25 and NIP-18 put the target note in the last `e` tag; earlier ones
// may point at the thread root.
function getEngagementTargetId(tags: string[][]): string | undefined {
  return tags.findLast(
    (tag) => tag[0] === 'e' && typeof tag[1] === 'string'
  )?.[1]
}

function toEngagementEvent(
  event: RawEngagementEvent
): NostrEngagementEvent | null {
  const targetId = getEngagementTargetId(event.tags)
  if (!targetId) {
    return null
  }
  return {
    content: event.content,
    created_at: event.created_at,
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    targetId
  }
}

// NIP-09: a deletion only counts when its author also wrote the event.
function dropDeletedEngagement(
  events: NostrEngagementEvent[],
  deletions: NostrEngagementDeletion[]
): NostrEngagementEvent[] {
  const deletedKeys = new Set(
    deletions.flatMap((deletion) =>
      deletion.tags
        .filter((tag) => tag[0] === 'e' && typeof tag[1] === 'string')
        .map((tag) => `${deletion.pubkey}:${tag[1]}`)
    )
  )
  return events.filter(
    (event) => !deletedKeys.has(`${event.pubkey}:${event.id}`)
  )
}

function getLatestReactionByPubkey(
  events: NostrEngagementEvent[]
): NostrEngagementEvent[] {
  const latest = new Map<string, NostrEngagementEvent>()
  for (const event of events) {
    const current = latest.get(event.pubkey)
    if (!current || event.created_at > current.created_at) {
      latest.set(event.pubkey, event)
    }
  }
  return [...latest.values()]
}

function summarizeNoteEngagement(
  events: NostrEngagementEvent[],
  ownPubkey: string
): NostrNoteEngagement {
  const reactions = events.filter((event) => event.kind === nostrKinds.Reaction)
  const reposts = events.filter((event) => isRepostKind(event.kind))
  const ownIds = (matches: NostrEngagementEvent[]) =>
    matches.filter((event) => event.pubkey === ownPubkey).map(({ id }) => id)

  return {
    likeCount: getLatestReactionByPubkey(reactions).filter(isLike).length,
    ownLikeIds: ownIds(reactions.filter(isLike)),
    ownRepostIds: ownIds(reposts),
    repostCount: new Set(reposts.map((event) => event.pubkey)).size
  }
}

type EngagementAction = 'like' | 'repost'

const PENDING_ENGAGEMENT_ID: Record<EngagementAction, string> = {
  like: 'pending-like',
  repost: 'pending-repost'
}

function getOwnEngagementIds(
  engagement: NostrNoteEngagement,
  action: EngagementAction
): string[] {
  return action === 'like' ? engagement.ownLikeIds : engagement.ownRepostIds
}

/** The events as they will look once the toggle lands, for optimistic UI. */
function applyEngagementToggle(
  events: NostrEngagementEvent[],
  action: EngagementAction,
  ownIds: string[],
  pending: { createdAt: number; noteId: string; ownPubkey: string }
): NostrEngagementEvent[] {
  if (ownIds.length > 0) {
    return events.filter((event) => !ownIds.includes(event.id))
  }
  return [
    ...events,
    {
      content: action === 'like' ? NOSTR_LIKE_CONTENT : '',
      created_at: pending.createdAt,
      id: PENDING_ENGAGEMENT_ID[action],
      kind: action === 'like' ? nostrKinds.Reaction : nostrKinds.Repost,
      pubkey: pending.ownPubkey,
      targetId: pending.noteId
    }
  ]
}

/** Swaps the optimistic placeholder for the event the relay accepted. */
function settleEngagementToggle(
  events: NostrEngagementEvent[],
  action: EngagementAction,
  published: NostrEngagementEvent | null
): NostrEngagementEvent[] {
  const settled = events.filter(
    (event) => event.id !== PENDING_ENGAGEMENT_ID[action]
  )
  return published ? [...settled, published] : settled
}

function buildReactionTags(target: EngagementTarget): string[][] {
  return [
    ['e', target.id],
    ['p', target.pubkey],
    ['k', String(target.kind)]
  ]
}

// NIP-18: kind 6 reposts kind 1 notes; kind 16 reposts everything else and
// names the original kind in a `k` tag.
function buildRepost(target: EngagementTarget, relayHint: string) {
  if (target.kind === nostrKinds.ShortTextNote) {
    return {
      kind: nostrKinds.Repost,
      tags: [
        ['e', target.id, relayHint],
        ['p', target.pubkey]
      ]
    }
  }
  return {
    kind: nostrKinds.GenericRepost,
    tags: [
      ['e', target.id, relayHint],
      ['p', target.pubkey],
      ['k', String(target.kind)]
    ]
  }
}

export {
  EMPTY_ENGAGEMENT,
  applyEngagementToggle,
  getOwnEngagementIds,
  settleEngagementToggle,
  NOSTR_ENGAGEMENT_KINDS,
  NOSTR_LIKE_CONTENT,
  buildReactionTags,
  buildRepost,
  dropDeletedEngagement,
  getEngagementTargetId,
  isLike,
  isRepostKind,
  summarizeNoteEngagement,
  toEngagementEvent
}
export type { EngagementAction, EngagementTarget, RawEngagementEvent }
