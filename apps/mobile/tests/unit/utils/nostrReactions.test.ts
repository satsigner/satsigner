import {
  buildReactionTags,
  dropDeletedReactions,
  isLikeReaction,
  summarizeNoteLikes
} from '@/utils/nostrReactions'

const ALICE = 'a'.repeat(64)
const BOB = 'b'.repeat(64)
const NOTE_ID = 'c'.repeat(64)

function reaction(id: string, pubkey: string, content: string, createdAt = 1) {
  return { content, created_at: createdAt, id, pubkey }
}

describe('isLikeReaction', () => {
  it('reads "+" and empty content as a like', () => {
    expect(isLikeReaction({ content: '+' })).toBe(true)
    expect(isLikeReaction({ content: '' })).toBe(true)
  })

  it('does not read dislikes or emoji as likes', () => {
    expect(isLikeReaction({ content: '-' })).toBe(false)
    expect(isLikeReaction({ content: '🔥' })).toBe(false)
  })
})

describe('summarizeNoteLikes', () => {
  it('counts each author once', () => {
    const likes = summarizeNoteLikes(
      [
        reaction('1', ALICE, '+', 1),
        reaction('2', ALICE, '+', 2),
        reaction('3', BOB, '+', 1)
      ],
      ALICE
    )

    expect(likes.count).toBe(2)
    expect(likes.ownLikeIds).toStrictEqual(['1', '2'])
  })

  it('uses the latest reaction of each author', () => {
    const likes = summarizeNoteLikes(
      [reaction('1', BOB, '+', 1), reaction('2', BOB, '-', 2)],
      ALICE
    )

    expect(likes).toStrictEqual({ count: 0, ownLikeIds: [] })
  })

  it('returns no likes for no reactions', () => {
    expect(summarizeNoteLikes([], ALICE)).toStrictEqual({
      count: 0,
      ownLikeIds: []
    })
  })
})

describe('dropDeletedReactions', () => {
  it('drops reactions their own author deleted', () => {
    const reactions = [reaction('1', ALICE, '+'), reaction('2', BOB, '+')]

    const kept = dropDeletedReactions(reactions, [
      { pubkey: ALICE, tags: [['e', '1']] }
    ])

    expect(kept.map((item) => item.id)).toStrictEqual(['2'])
  })

  it('ignores deletions from someone else', () => {
    const reactions = [reaction('1', ALICE, '+')]

    const kept = dropDeletedReactions(reactions, [
      { pubkey: BOB, tags: [['e', '1']] }
    ])

    expect(kept).toHaveLength(1)
  })
})

describe('buildReactionTags', () => {
  it('tags the note, its author and its kind', () => {
    expect(
      buildReactionTags({ id: NOTE_ID, kind: 1, pubkey: BOB })
    ).toStrictEqual([
      ['e', NOTE_ID],
      ['p', BOB],
      ['k', '1']
    ])
  })
})
