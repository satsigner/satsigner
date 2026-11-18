import type { NostrChatReaction } from '@/types/models/Nostr'
import {
  buildChatReactionTags,
  getChatAgentStatus,
  getReactionTargetId,
  groupReactionsByMessage,
  parseReactionEmoji,
  summarizeChatReactions
} from '@/utils/nostrChatReactions'

const ME = 'a'.repeat(64)
const PEER = 'b'.repeat(64)
const MSG_1 = '1'.repeat(64)
const MSG_2 = '2'.repeat(64)

function reaction(
  overrides: Partial<NostrChatReaction> & Pick<NostrChatReaction, 'id'>
): NostrChatReaction {
  return {
    author: PEER,
    created_at: 100,
    emoji: '👍',
    identityNpub: 'npub1me',
    messageId: MSG_1,
    ...overrides
  }
}

describe('parseReactionEmoji', () => {
  it('reads "+" and empty content as a thumbs up and keeps emoji as sent', () => {
    expect(parseReactionEmoji('+')).toBe('👍')
    expect(parseReactionEmoji('')).toBe('👍')
    expect(parseReactionEmoji(' 🔥 ')).toBe('🔥')
    expect(parseReactionEmoji('👨‍👩‍👧')).toBe('👨‍👩‍👧')
  })

  it('drops dislikes, whitespace-only and oversized content', () => {
    expect(parseReactionEmoji('-')).toBeNull()
    expect(parseReactionEmoji('   ')).toBeNull()
    expect(parseReactionEmoji('x'.repeat(33))).toBeNull()
  })
})

describe('getReactionTargetId', () => {
  it('rejects an invalid last e tag instead of an earlier valid one', () => {
    expect(
      getReactionTargetId([
        ['e', MSG_1],
        ['e', 'not-hex']
      ])
    ).toBeNull()
  })

  it('takes the last e tag (NIP-25)', () => {
    expect(
      getReactionTargetId([
        ['e', MSG_1],
        ['p', PEER],
        ['e', MSG_2]
      ])
    ).toBe(MSG_2)
  })

  it('ignores malformed e tags and non-arrays', () => {
    expect(getReactionTargetId([['e', 'not-hex']])).toBeNull()
    expect(getReactionTargetId([['e', 'F'.repeat(64)]])).toBeNull()
    expect(getReactionTargetId('tags')).toBeNull()
    expect(getReactionTargetId(undefined)).toBeNull()
  })
})

describe('buildChatReactionTags', () => {
  it('targets the message and names its kind', () => {
    expect(buildChatReactionTags(MSG_1)).toStrictEqual([
      ['e', MSG_1],
      ['k', '14']
    ])
  })
})

describe('summarizeChatReactions', () => {
  it('counts each author once per emoji and marks my reaction', () => {
    const summary = summarizeChatReactions(
      [
        reaction({ created_at: 10, id: 'r1' }),
        reaction({ created_at: 11, id: 'r2' }),
        reaction({ author: ME, created_at: 12, id: 'r3' }),
        reaction({ created_at: 13, emoji: '❤️', id: 'r4' })
      ],
      ME
    )
    expect(summary).toStrictEqual([
      { count: 2, emoji: '👍', ownReactionId: 'r3' },
      { count: 1, emoji: '❤️' }
    ])
  })

  it('orders emoji by first use', () => {
    const summary = summarizeChatReactions(
      [
        reaction({ created_at: 20, emoji: '👍', id: 'r1' }),
        reaction({ author: ME, created_at: 5, emoji: '🙏', id: 'r2' })
      ],
      ME
    )
    expect(summary.map((s) => s.emoji)).toStrictEqual(['🙏', '👍'])
  })
})

describe('getChatAgentStatus', () => {
  it('follows the newest status emoji from the peer', () => {
    const reactions = [
      reaction({ created_at: 10, emoji: '👀', id: 'r1' }),
      reaction({ created_at: 20, emoji: '✅', id: 'r2' })
    ]
    expect(getChatAgentStatus(reactions, PEER)).toBe('answered')
    expect(getChatAgentStatus(reactions.slice(0, 1), PEER)).toBe('working')
    expect(
      getChatAgentStatus(
        [reaction({ created_at: 30, emoji: '⚠️', id: 'r3' })],
        PEER
      )
    ).toBe('error')
  })

  it('ignores my own reactions and non-status emoji', () => {
    expect(
      getChatAgentStatus(
        [
          reaction({ author: ME, emoji: '✅', id: 'r1' }),
          reaction({ emoji: '👍', id: 'r2' })
        ],
        PEER
      )
    ).toBeNull()
  })

  it('lets an outcome win over working within the same second', () => {
    const reactions = [
      reaction({ created_at: 10, emoji: '✅', id: 'r1' }),
      reaction({ created_at: 10, emoji: '👀', id: 'r2' })
    ]
    expect(getChatAgentStatus(reactions, PEER)).toBe('answered')
    expect(getChatAgentStatus(reactions.toReversed(), PEER)).toBe('answered')
  })

  it('ignores reactions named after object prototype keys', () => {
    const reactions = ['constructor', 'toString', '__proto__'].map(
      (emoji, index) => reaction({ emoji, id: `r${index}` })
    )
    expect(getChatAgentStatus(reactions, PEER)).toBeNull()
  })
})

describe('groupReactionsByMessage', () => {
  it('groups by target message', () => {
    const grouped = groupReactionsByMessage([
      reaction({ id: 'r1' }),
      reaction({ id: 'r2', messageId: MSG_2 }),
      reaction({ id: 'r3' })
    ])
    expect(grouped.get(MSG_1)?.map((r) => r.id)).toStrictEqual(['r1', 'r3'])
    expect(grouped.get(MSG_2)?.map((r) => r.id)).toStrictEqual(['r2'])
  })
})
