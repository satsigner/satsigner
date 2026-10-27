import * as nostrKinds from 'nostr-tools/kinds'

import type { NostrFeedNoteLike } from '@/types/models/Nostr'
import {
  clearNoteContentCache,
  getNoteProfilePubkeys,
  parseNoteContent
} from '@/utils/nostrNoteContent'

const AUTHOR = 'a'.repeat(64)
const MENTIONED = 'b'.repeat(64)
const QUOTED_AUTHOR = 'c'.repeat(64)
const IMAGE = 'https://example.com/cat.png'
const VIDEO = 'https://example.com/clip.mp4'

function note(overrides: Partial<NostrFeedNoteLike>): NostrFeedNoteLike {
  return {
    content: '',
    created_at: 1,
    id: 'n'.repeat(64),
    kind: nostrKinds.ShortTextNote,
    pubkey: AUTHOR,
    tags: [],
    ...overrides
  }
}

describe('parseNoteContent', () => {
  beforeEach(() => {
    clearNoteContentCache()
  })

  it('splits images, videos and mentions out of the text', () => {
    const parsed = parseNoteContent(
      note({
        content: `hello nostr:npub1${MENTIONED}\n${IMAGE}\n${VIDEO}`
      })
    )

    expect(parsed.imageUrls).toStrictEqual([IMAGE])
    expect(parsed.videoEmbeds.map((embed) => embed.watchUrl)).toStrictEqual([
      VIDEO
    ])
    expect(parsed.text).not.toContain(IMAGE)
    expect(parsed.mentionPubkeys).toStrictEqual([MENTIONED])
    expect(parsed.isRepost).toBe(false)
  })

  it('caches by note id so a note is parsed once', () => {
    const first = parseNoteContent(note({ content: IMAGE }))
    const second = parseNoteContent(note({ content: IMAGE }))

    expect(second).toBe(first)
  })

  it('marks a repost without an embedded or resolved original as unavailable', () => {
    const repost = note({ content: '', kind: nostrKinds.Repost })

    expect(parseNoteContent(repost).repostUnavailable).toBe(true)

    const original = note({
      content: IMAGE,
      id: 'o'.repeat(64),
      pubkey: QUOTED_AUTHOR
    })
    const resolved = parseNoteContent(repost, original)
    expect(resolved.repostUnavailable).toBe(false)
    expect(resolved.contentNote).toBe(original)
    expect(resolved.imageUrls).toStrictEqual([IMAGE])
  })
})

describe('getNoteProfilePubkeys', () => {
  it('lists the author, mentions and the quoted author', () => {
    const quoted = note({ id: 'q'.repeat(64), pubkey: QUOTED_AUTHOR })
    expect(
      getNoteProfilePubkeys(
        note({ content: `hi nostr:npub1${MENTIONED}`, id: 'm'.repeat(64) }),
        quoted
      )
    ).toStrictEqual([AUTHOR, MENTIONED, QUOTED_AUTHOR])
  })
})
