import { type NostrChatFilter } from '@/store/nostrChatSettings'
import {
  type NostrChatConversationItem,
  type NostrFetchResult,
  type NostrFollowList
} from '@/types/models/Nostr'

type InboundMessageCheck = {
  /** Peer we already wrote to, so the thread is a conversation, not spam. */
  hasConversation: boolean
  isFollowed: boolean
  isOwn: boolean
  minPowBits: number
  pow: number
}

/**
 * Proof of work is only demanded from strangers: our own copies, people we
 * follow and peers we already talk to always get through.
 */
function isInboundMessageAllowed({
  hasConversation,
  isFollowed,
  isOwn,
  minPowBits,
  pow
}: InboundMessageCheck): boolean {
  return (
    isOwn ||
    isFollowed ||
    hasConversation ||
    minPowBits <= 0 ||
    pow >= minPowBits
  )
}

type ConversationBuckets = {
  following: NostrChatConversationItem[]
  others: NostrChatConversationItem[]
}

/**
 * Splits the inbox into people we follow (or wrote to, or ourselves) and
 * message requests from everyone else. Without a follow list every
 * conversation stays visible, so an outage never hides messages.
 */
function splitConversationsByFollows(
  conversations: NostrChatConversationItem[],
  followedPubkeys: ReadonlySet<string> | null,
  ownPubkey: string | null,
  peersWrittenTo: ReadonlySet<string>
): ConversationBuckets {
  if (followedPubkeys === null) {
    return { following: conversations, others: [] }
  }
  const isKnown = (peerPubkey: string) =>
    peerPubkey === ownPubkey ||
    followedPubkeys.has(peerPubkey) ||
    peersWrittenTo.has(peerPubkey)
  return {
    following: conversations.filter((item) => isKnown(item.peerPubkey)),
    others: conversations.filter((item) => !isKnown(item.peerPubkey))
  }
}

/**
 * A failed fetch with nothing cached yields an empty list that would push
 * every conversation into "others", so it counts as unknown instead.
 */
function getFollowedPubkeySet(
  result: NostrFetchResult<NostrFollowList> | undefined
): ReadonlySet<string> | null {
  if (!result) {
    return null
  }
  if (result.error && result.data.pubkeys.length === 0) {
    return null
  }
  return new Set(result.data.pubkeys)
}

type InboxSelectionInput = {
  conversations: NostrChatConversationItem[]
  filter: NostrChatFilter
  followedPubkeys: ReadonlySet<string> | null
  ownPubkey: string | null
  peersWrittenTo: ReadonlySet<string>
}

type InboxSelection = {
  othersCount: number
  visibleConversations: NostrChatConversationItem[]
}

function selectInboxConversations({
  conversations,
  filter,
  followedPubkeys,
  ownPubkey,
  peersWrittenTo
}: InboxSelectionInput): InboxSelection {
  const { following, others } = splitConversationsByFollows(
    conversations,
    followedPubkeys,
    ownPubkey,
    peersWrittenTo
  )
  return {
    othersCount: others.length,
    visibleConversations:
      followedPubkeys !== null && filter === 'others' ? others : following
  }
}

export {
  getFollowedPubkeySet,
  isInboundMessageAllowed,
  selectInboxConversations,
  splitConversationsByFollows
}
export type { ConversationBuckets }
