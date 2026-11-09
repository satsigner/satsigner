import { type NostrChatConversationItem } from '@/types/models/Nostr'
import {
  isInboundMessageAllowed,
  splitConversationsByFollows
} from '@/utils/nostrChatFilter'

const STRANGER = {
  hasConversation: false,
  isFollowed: false,
  isOwn: false,
  minPowBits: 16,
  pow: 0
}

describe('isInboundMessageAllowed', () => {
  it('rejects a stranger below the minimum proof of work', () => {
    expect(isInboundMessageAllowed({ ...STRANGER, pow: 15 })).toBe(false)
  })

  it('accepts a stranger at or above the minimum', () => {
    expect(isInboundMessageAllowed({ ...STRANGER, pow: 16 })).toBe(true)
  })

  it('never demands work from followed, known or own senders', () => {
    expect(isInboundMessageAllowed({ ...STRANGER, isFollowed: true })).toBe(
      true
    )
    expect(
      isInboundMessageAllowed({ ...STRANGER, hasConversation: true })
    ).toBe(true)
    expect(isInboundMessageAllowed({ ...STRANGER, isOwn: true })).toBe(true)
  })

  it('accepts everyone when the filter is off', () => {
    expect(isInboundMessageAllowed({ ...STRANGER, minPowBits: 0 })).toBe(true)
  })
})

function conversation(peerPubkey: string): NostrChatConversationItem {
  return {
    lastMessageAt: 0,
    lastMessagePreview: '',
    peerNpub: `npub-${peerPubkey}`,
    peerPubkey,
    unreadCount: 0
  }
}

describe('splitConversationsByFollows', () => {
  const conversations = ['followed', 'stranger', 'self', 'written'].map(
    conversation
  )

  it('splits followed, self and written-to peers from strangers', () => {
    const { following, others } = splitConversationsByFollows(
      conversations,
      new Set(['followed']),
      'self',
      new Set(['written'])
    )

    expect(following.map((item) => item.peerPubkey)).toStrictEqual([
      'followed',
      'self',
      'written'
    ])
    expect(others.map((item) => item.peerPubkey)).toStrictEqual(['stranger'])
  })

  it('shows everything when the follow list is unknown', () => {
    expect(
      splitConversationsByFollows(conversations, null, 'self', new Set())
    ).toStrictEqual({ following: conversations, others: [] })
  })

  it('treats an empty follow list as following nobody', () => {
    const { others } = splitConversationsByFollows(
      conversations,
      new Set(),
      null,
      new Set()
    )

    expect(others).toHaveLength(4)
  })
})
