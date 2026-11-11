import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import {
  buildNoteEventJson,
  getNoteTagsForDisplay
} from '@/utils/nostrNoteDetail'

const MEDIA_URL = 'https://blossom.example/photo.jpg'
const NOTE = {
  content: 'a private thought',
  created_at: 1_700_000_000,
  kind: 1,
  pubkey: 'author',
  tags: [['imeta', `url ${MEDIA_URL}`, 'm image/jpeg'], ['p', 'friend'], ['t']]
}

describe('getNoteTagsForDisplay', () => {
  it('shows tags as they are outside privacy mode', () => {
    expect(getNoteTagsForDisplay(NOTE.tags, false)).toBe(NOTE.tags)
  })

  it('masks tag values but keeps tag names in privacy mode', () => {
    expect(getNoteTagsForDisplay(NOTE.tags, true)).toStrictEqual([
      ['imeta', NOSTR_PRIVACY_MASK],
      ['p', NOSTR_PRIVACY_MASK],
      ['t']
    ])
  })
})

describe('buildNoteEventJson', () => {
  it('shows the full event outside privacy mode', () => {
    expect(
      JSON.parse(buildNoteEventJson(NOTE, 'note-id', false))
    ).toStrictEqual({ ...NOTE, id: 'note-id' })
  })

  it('hides the content and tag values in privacy mode', () => {
    const json = buildNoteEventJson(NOTE, 'note-id', true)

    expect(json).not.toContain(NOTE.content)
    expect(json).not.toContain(MEDIA_URL)
    expect(JSON.parse(json)).toMatchObject({
      content: NOSTR_PRIVACY_MASK,
      id: 'note-id',
      kind: 1
    })
  })
})
