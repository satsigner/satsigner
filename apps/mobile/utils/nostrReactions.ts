import {
  type NostrNoteLikes,
  type NostrReaction,
  type NostrReactionDeletion
} from '@/types/models/Nostr'

const NOSTR_LIKE_CONTENT = '+'

// NIP-25: an empty content is also read as a like.
function isLikeReaction(reaction: Pick<NostrReaction, 'content'>): boolean {
  return (
    reaction.content === NOSTR_LIKE_CONTENT || reaction.content.length === 0
  )
}

// NIP-09: a deletion only counts when its author also wrote the reaction.
function dropDeletedReactions(
  reactions: NostrReaction[],
  deletions: NostrReactionDeletion[]
): NostrReaction[] {
  const deletedKeys = new Set(
    deletions.flatMap((deletion) =>
      deletion.tags
        .filter((tag) => tag[0] === 'e' && typeof tag[1] === 'string')
        .map((tag) => `${deletion.pubkey}:${tag[1]}`)
    )
  )
  return reactions.filter(
    (reaction) => !deletedKeys.has(`${reaction.pubkey}:${reaction.id}`)
  )
}

function getLatestReactionByPubkey(
  reactions: NostrReaction[]
): Map<string, NostrReaction> {
  const latest = new Map<string, NostrReaction>()
  for (const reaction of reactions) {
    const current = latest.get(reaction.pubkey)
    if (!current || reaction.created_at > current.created_at) {
      latest.set(reaction.pubkey, reaction)
    }
  }
  return latest
}

function summarizeNoteLikes(
  reactions: NostrReaction[],
  ownPubkey: string
): NostrNoteLikes {
  const latest = [...getLatestReactionByPubkey(reactions).values()]
  return {
    count: latest.filter(isLikeReaction).length,
    ownLikeIds: reactions
      .filter(
        (reaction) => reaction.pubkey === ownPubkey && isLikeReaction(reaction)
      )
      .map((reaction) => reaction.id)
  }
}

function buildReactionTags(target: {
  id: string
  kind: number
  pubkey: string
}): string[][] {
  return [
    ['e', target.id],
    ['p', target.pubkey],
    ['k', String(target.kind)]
  ]
}

export {
  NOSTR_LIKE_CONTENT,
  buildReactionTags,
  dropDeletedReactions,
  isLikeReaction,
  summarizeNoteLikes
}
