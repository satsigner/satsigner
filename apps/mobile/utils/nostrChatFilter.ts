import { type NostrChatConversationItem } from '@/types/models/Nostr'

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

export { isInboundMessageAllowed, splitConversationsByFollows }
export type { ConversationBuckets }
