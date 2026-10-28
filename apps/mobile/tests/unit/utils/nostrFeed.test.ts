import {
  NOSTR_FEED_MAX_EMPTY_PAGES,
  NOSTR_FEED_WINDOW_MAX_ITEMS
} from '@/constants/nostr'
import {
  filterFeedReplies,
  flattenFeedPages,
  getDeletedEventIds,
  getFollowedPubkeysFromTags,
  getNextFeedPageParam,
  mergeNotesNewestFirst
} from '@/utils/nostrFeed'

const AUTHOR = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)
const EVENT_1 = '1'.repeat(64)
const EVENT_2 = '2'.repeat(64)

function item(id: string, createdAt: number) {
  return { created_at: createdAt, id }
}

function note(id: string, createdAt: number, tags: string[][] = []) {
  return {
    content: '',
    created_at: createdAt,
    id,
    kind: 1,
    pubkey: AUTHOR,
    tags
  }
}

describe('getNextFeedPageParam', () => {
  it('pages from the oldest timestamp of the last page', () => {
    const pages = [[item('a', 300), item('b', 200)]]
    expect(getNextFeedPageParam(pages, undefined)).toBe(200)
  })

  it('never repeats a boundary', () => {
    const pages = [
      [item('a', 300), item('b', 200)],
      [item('b', 200), item('c', 200)]
    ]
    expect(getNextFeedPageParam(pages, 200)).toBe(199)
  })

  it('stops on an empty page', () => {
    expect(getNextFeedPageParam([[item('a', 300)], []], 300)).toBeUndefined()
  })

  it(`stops after ${NOSTR_FEED_MAX_EMPTY_PAGES} pages that added nothing new`, () => {
    const first = [item('a', 300), item('b', 200)]
    const repeats = Array.from({ length: NOSTR_FEED_MAX_EMPTY_PAGES }, () => [
      item('b', 200)
    ])
    expect(getNextFeedPageParam([first, ...repeats], 200)).toBeUndefined()
    expect(
      getNextFeedPageParam([first, ...repeats.slice(1)], 200)
    ).toBeDefined()
  })

  it('stops once the window is full', () => {
    const page = Array.from({ length: NOSTR_FEED_WINDOW_MAX_ITEMS }, (_, i) =>
      item(`id-${i}`, 10_000 - i)
    )
    expect(getNextFeedPageParam([page], undefined)).toBeUndefined()
  })
})

describe('flattenFeedPages', () => {
  it('dedupes across pages and caps the window', () => {
    const page = Array.from(
      { length: NOSTR_FEED_WINDOW_MAX_ITEMS + 10 },
      (_, i) => item(`id-${i}`, i)
    )
    expect(flattenFeedPages([[item('x', 1)], [item('x', 1)]])).toHaveLength(1)
    expect(flattenFeedPages([page])).toHaveLength(NOSTR_FEED_WINDOW_MAX_ITEMS)
  })
})

describe('mergeNotesNewestFirst', () => {
  it('prefers relay copies and sorts newest first', () => {
    const fresh = [{ ...note(EVENT_1, 100), content: 'fresh' }]
    const cached = [note(EVENT_1, 100), note(EVENT_2, 200)]
    const merged = mergeNotesNewestFirst(fresh, cached, 10)
    expect(merged.map((n) => n.id)).toStrictEqual([EVENT_2, EVENT_1])
    expect(merged[1]?.content).toBe('fresh')
  })
})

describe('getDeletedEventIds', () => {
  it('only honours deletions signed by the author', () => {
    const ids = getDeletedEventIds(
      [
        {
          pubkey: AUTHOR,
          tags: [
            ['e', EVENT_1],
            ['p', OTHER]
          ]
        },
        { pubkey: OTHER, tags: [['e', EVENT_2]] }
      ],
      AUTHOR
    )
    expect([...ids]).toStrictEqual([EVENT_1])
  })
})

describe('getFollowedPubkeysFromTags', () => {
  it('keeps p tags in order, lowercased, without duplicates or self', () => {
    expect(
      getFollowedPubkeysFromTags(
        [
          ['p', OTHER.toUpperCase()],
          ['p', AUTHOR],
          ['p', OTHER],
          ['p', 'bad']
        ],
        AUTHOR
      )
    ).toStrictEqual([OTHER])
  })
})

describe('filterFeedReplies', () => {
  it('hides replies only when asked', () => {
    const reply = note(EVENT_2, 1, [['e', EVENT_1, '', 'reply']])
    const notes = [note(EVENT_1, 2), reply]
    expect(filterFeedReplies(notes, true).map((n) => n.id)).toStrictEqual([
      EVENT_1
    ])
    expect(filterFeedReplies(notes, false)).toBe(notes)
  })
})
