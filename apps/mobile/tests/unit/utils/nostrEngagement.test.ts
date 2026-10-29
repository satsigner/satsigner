import * as nostrKinds from 'nostr-tools/kinds'

import {
  applyEngagementToggle,
  buildReactionTags,
  buildRepost,
  dropDeletedEngagement,
  getEngagementTargetId,
  isLike,
  settleEngagementToggle,
  summarizeNoteEngagement,
  toEngagementEvent
} from '@/utils/nostrEngagement'

const ALICE = 'a'.repeat(64)
const BOB = 'b'.repeat(64)
const NOTE_ID = 'c'.repeat(64)
const ROOT_ID = 'd'.repeat(64)
const RELAY = 'wss://relay.test'

function engagement(
  id: string,
  pubkey: string,
  kind: number,
  content = '',
  createdAt = 1
) {
  return { content, created_at: createdAt, id, kind, pubkey, targetId: NOTE_ID }
}

describe('isLike', () => {
  it('reads "+" and empty reactions as likes', () => {
    expect(isLike({ content: '+', kind: nostrKinds.Reaction })).toBe(true)
    expect(isLike({ content: '', kind: nostrKinds.Reaction })).toBe(true)
  })

  it('does not read dislikes, emoji or reposts as likes', () => {
    expect(isLike({ content: '-', kind: nostrKinds.Reaction })).toBe(false)
    expect(isLike({ content: '🔥', kind: nostrKinds.Reaction })).toBe(false)
    expect(isLike({ content: '', kind: nostrKinds.Repost })).toBe(false)
  })
})

describe('getEngagementTargetId', () => {
  it('uses the last e tag, not the thread root', () => {
    expect(
      getEngagementTargetId([
        ['e', ROOT_ID],
        ['p', ALICE],
        ['e', NOTE_ID]
      ])
    ).toBe(NOTE_ID)
  })

  it('returns nothing without an e tag', () => {
    expect(getEngagementTargetId([['p', ALICE]])).toBeUndefined()
  })
})

describe('toEngagementEvent', () => {
  it('drops events that do not point at a note', () => {
    expect(
      toEngagementEvent({
        content: '+',
        created_at: 1,
        id: '1',
        kind: nostrKinds.Reaction,
        pubkey: ALICE,
        tags: []
      })
    ).toBeNull()
  })
})

describe('summarizeNoteEngagement', () => {
  it('counts each liker once, by their latest reaction', () => {
    const summary = summarizeNoteEngagement(
      [
        engagement('1', ALICE, nostrKinds.Reaction, '+', 1),
        engagement('2', ALICE, nostrKinds.Reaction, '+', 2),
        engagement('3', BOB, nostrKinds.Reaction, '+', 1),
        engagement('4', BOB, nostrKinds.Reaction, '-', 2)
      ],
      ALICE
    )

    expect(summary.likeCount).toBe(1)
    expect(summary.ownLikeIds).toStrictEqual(['1', '2'])
  })

  it('counts reposts by distinct author across kinds 6 and 16', () => {
    const summary = summarizeNoteEngagement(
      [
        engagement('1', ALICE, nostrKinds.Repost),
        engagement('2', ALICE, nostrKinds.GenericRepost),
        engagement('3', BOB, nostrKinds.Repost)
      ],
      BOB
    )

    expect(summary.repostCount).toBe(2)
    expect(summary.ownRepostIds).toStrictEqual(['3'])
    expect(summary.likeCount).toBe(0)
  })
})

describe('dropDeletedEngagement', () => {
  it('drops events their own author deleted', () => {
    const kept = dropDeletedEngagement(
      [
        engagement('1', ALICE, nostrKinds.Reaction, '+'),
        engagement('2', BOB, nostrKinds.Reaction, '+')
      ],
      [{ pubkey: ALICE, tags: [['e', '1']] }]
    )

    expect(kept.map((event) => event.id)).toStrictEqual(['2'])
  })

  it('ignores deletions from someone else', () => {
    const kept = dropDeletedEngagement(
      [engagement('1', ALICE, nostrKinds.Reaction, '+')],
      [{ pubkey: BOB, tags: [['e', '1']] }]
    )

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

describe('buildRepost', () => {
  it('reposts kind 1 notes as kind 6', () => {
    expect(
      buildRepost(
        { id: NOTE_ID, kind: nostrKinds.ShortTextNote, pubkey: BOB },
        RELAY
      )
    ).toStrictEqual({
      kind: nostrKinds.Repost,
      tags: [
        ['e', NOTE_ID, RELAY],
        ['p', BOB]
      ]
    })
  })

  it('reposts other kinds as kind 16 with a k tag', () => {
    expect(
      buildRepost(
        { id: NOTE_ID, kind: nostrKinds.LongFormArticle, pubkey: BOB },
        RELAY
      )
    ).toStrictEqual({
      kind: nostrKinds.GenericRepost,
      tags: [
        ['e', NOTE_ID, RELAY],
        ['p', BOB],
        ['k', String(nostrKinds.LongFormArticle)]
      ]
    })
  })
})

describe('optimistic toggles', () => {
  const pending = { createdAt: 5, noteId: NOTE_ID, ownPubkey: ALICE }

  it('adds a placeholder like, then swaps in the published event', () => {
    const optimistic = applyEngagementToggle([], 'like', [], pending)

    expect(summarizeNoteEngagement(optimistic, ALICE).likeCount).toBe(1)

    const published = engagement('real', ALICE, nostrKinds.Reaction, '+', 5)
    expect(settleEngagementToggle(optimistic, 'like', published)).toStrictEqual(
      [published]
    )
  })

  it('removes own events when undoing', () => {
    const events = [
      engagement('1', ALICE, nostrKinds.Repost),
      engagement('2', BOB, nostrKinds.Repost)
    ]

    const optimistic = applyEngagementToggle(events, 'repost', ['1'], pending)

    expect(optimistic.map((event) => event.id)).toStrictEqual(['2'])
  })
})
