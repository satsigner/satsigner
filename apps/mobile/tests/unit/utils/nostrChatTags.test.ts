import {
  buildMessageDeletionTags,
  buildReplyTag,
  getDeletionTargetIds,
  getReplyToId
} from '@/utils/nostrChatTags'

const PARENT = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)

describe('reply tags', () => {
  it('round-trips a reply tag', () => {
    expect(getReplyToId([['p', OTHER], buildReplyTag(PARENT)])).toBe(PARENT)
  })

  it('prefers the reply marker over other e tags', () => {
    expect(
      getReplyToId([
        ['e', OTHER],
        ['e', PARENT, '', 'reply']
      ])
    ).toBe(PARENT)
  })

  it('falls back to a plain e tag', () => {
    expect(getReplyToId([['e', PARENT]])).toBe(PARENT)
  })

  it('ignores malformed tags', () => {
    expect(getReplyToId([['e', 'not-hex'], ['e'], 'junk'])).toBeUndefined()
    expect(getReplyToId(undefined)).toBeUndefined()
  })
})

describe('deletion tags', () => {
  it('builds e tags plus the kind of the deleted messages', () => {
    expect(buildMessageDeletionTags([PARENT, OTHER])).toStrictEqual([
      ['e', PARENT],
      ['e', OTHER],
      ['k', '14']
    ])
  })

  it('reads only valid event ids back', () => {
    expect(
      getDeletionTargetIds([...buildMessageDeletionTags([PARENT]), ['e', 'x']])
    ).toStrictEqual([PARENT])
  })
})
