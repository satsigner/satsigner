import { nip19 } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import {
  buildReactionsPage,
  dedupeReactionsByAuthor,
  getNextReactionsUntil,
  normalizeReaction,
  summarizeReactions,
  toReactionItems,
  toReactionRow
} from '@/utils/nostrReactions'

const ALICE = 'a'.repeat(64)
const BOB = 'b'.repeat(64)
const CAROL = 'e'.repeat(64)
const NOTE_ID = 'c'.repeat(64)
const OTHER_NOTE_ID = 'd'.repeat(64)
const EMOJI_URL = 'https://example.com/soapbox.png'

function reaction(
  id: string,
  pubkey: string,
  content: string,
  createdAt = 1,
  tags: string[][] = []
) {
  return {
    content,
    created_at: createdAt,
    id,
    kind: nostrKinds.Reaction,
    pubkey,
    tags: [['e', NOTE_ID], ...tags]
  }
}

function withTarget(event: ReturnType<typeof reaction>) {
  return { ...event, targetId: NOTE_ID }
}

describe('normalizeReaction', () => {
  it('treats "+" and empty content as a like', () => {
    expect(normalizeReaction({ content: '+', tags: [] }).type).toBe('like')
    expect(normalizeReaction({ content: '', tags: [] }).type).toBe('like')
    expect(normalizeReaction({ content: '  ', tags: [] }).type).toBe('like')
  })

  it('treats "-" as a dislike', () => {
    expect(normalizeReaction({ content: '-', tags: [] }).type).toBe('dislike')
  })

  it('keeps any other content as an emoji', () => {
    expect(normalizeReaction({ content: '🤙', tags: [] })).toStrictEqual({
      content: '🤙',
      key: 'emoji:🤙',
      type: 'emoji'
    })
  })

  it('resolves a NIP-30 shortcode to its emoji tag url', () => {
    expect(
      normalizeReaction({
        content: ':soapbox:',
        tags: [['emoji', 'soapbox', EMOJI_URL]]
      })
    ).toStrictEqual({
      key: `custom:soapbox:${EMOJI_URL}`,
      shortcode: 'soapbox',
      type: 'customEmoji',
      url: EMOJI_URL
    })
  })

  it('shows a shortcode without a matching emoji tag as text', () => {
    expect(
      normalizeReaction({
        content: ':soapbox:',
        tags: [['emoji', 'other', EMOJI_URL]]
      }).type
    ).toBe('emoji')
  })

  it('ignores custom emoji urls that are not https', () => {
    expect(
      normalizeReaction({
        content: ':soapbox:',
        tags: [['emoji', 'soapbox', 'http://example.com/soapbox.png']]
      }).type
    ).toBe('emoji')
  })
})

describe('dedupeReactionsByAuthor', () => {
  it('keeps the latest reaction per author, newest first', () => {
    const deduped = dedupeReactionsByAuthor([
      withTarget(reaction('1', ALICE, '+', 1)),
      withTarget(reaction('2', ALICE, '🔥', 5)),
      withTarget(reaction('3', BOB, '+', 3))
    ])

    expect(deduped.map((event) => event.id)).toStrictEqual(['2', '3'])
  })
})

describe('summarizeReactions', () => {
  it('counts each reaction and sorts by count', () => {
    const items = toReactionItems([
      withTarget(reaction('1', ALICE, '🔥')),
      withTarget(reaction('2', BOB, '+')),
      withTarget(reaction('3', CAROL, '🔥'))
    ])
    const summary = summarizeReactions(items.map((item) => item.reaction))

    expect(
      summary.map((entry) => [entry.reaction.key, entry.count])
    ).toStrictEqual([
      ['emoji:🔥', 2],
      ['like', 1]
    ])
  })

  it('returns nothing for no reactions', () => {
    expect(summarizeReactions([])).toStrictEqual([])
  })
})

describe('buildReactionsPage', () => {
  it('drops a reaction deleted by its own author', () => {
    const page = buildReactionsPage(
      NOTE_ID,
      [reaction('1', ALICE, '+'), reaction('2', BOB, '+')],
      [{ pubkey: ALICE, tags: [['e', '1']] }]
    )

    expect(page.reactions.map((event) => event.id)).toStrictEqual(['2'])
  })

  it('keeps a reaction when someone else signed the deletion', () => {
    const page = buildReactionsPage(
      NOTE_ID,
      [reaction('1', ALICE, '+')],
      [{ pubkey: BOB, tags: [['e', '1']] }]
    )

    expect(page.reactions.map((event) => event.id)).toStrictEqual(['1'])
  })

  it('skips reactions whose target is another note', () => {
    const replyReaction = {
      ...reaction('1', ALICE, '+'),
      tags: [
        ['e', NOTE_ID],
        ['e', OTHER_NOTE_ID]
      ]
    }
    const page = buildReactionsPage(NOTE_ID, [replyReaction], [])

    expect(page.reactions).toStrictEqual([])
    expect(page.fetchedCount).toBe(1)
  })

  it('keeps tags for custom emoji and tracks the oldest timestamp', () => {
    const tags = [['emoji', 'soapbox', EMOJI_URL]]
    const page = buildReactionsPage(
      NOTE_ID,
      [reaction('1', ALICE, ':soapbox:', 10, tags), reaction('2', BOB, '+', 4)],
      []
    )

    expect(page.oldestCreatedAt).toBe(4)
    expect(page.reactions[0]?.tags).toContainEqual(tags[0])
  })

  it('has no oldest timestamp when relays return nothing', () => {
    expect(buildReactionsPage(NOTE_ID, [], [])).toStrictEqual({
      fetchedCount: 0,
      oldestCreatedAt: null,
      reactions: []
    })
  })
})

describe('getNextReactionsUntil', () => {
  const LIMIT = 2

  it('pages from the oldest second so reactions sharing it are not skipped', () => {
    expect(
      getNextReactionsUntil(
        { fetchedCount: 2, oldestCreatedAt: 100, reactions: [] },
        LIMIT,
        120
      )
    ).toBe(100)
  })

  it('steps past a second that fills a whole page', () => {
    expect(
      getNextReactionsUntil(
        { fetchedCount: 2, oldestCreatedAt: 100, reactions: [] },
        LIMIT,
        100
      )
    ).toBe(99)
  })

  it('stops on a short page', () => {
    expect(
      getNextReactionsUntil(
        { fetchedCount: 1, oldestCreatedAt: 100, reactions: [] },
        LIMIT
      )
    ).toBeUndefined()
  })
})

describe('toReactionRow', () => {
  const item = {
    authorPubkey: ALICE,
    createdAt: 7,
    id: '1',
    reaction: normalizeReaction({ content: '+', tags: [] })
  }

  it('uses the profile display name and picture', () => {
    const row = toReactionRow(item, {
      displayName: 'Alice',
      picture: 'https://example.com/a.png'
    })

    expect(row.authorLabel).toBe('Alice')
    expect(row.authorPicture).toBe('https://example.com/a.png')
    expect(row.authorNpub).toBe(nip19.npubEncode(ALICE))
  })

  it('falls back to a short npub without a profile', () => {
    const row = toReactionRow(item, null)

    expect(row.authorLabel.length).toBeGreaterThan(0)
    expect(row.authorLabel).not.toBe('Alice')
    expect(row.authorPicture).toBeUndefined()
  })
})
