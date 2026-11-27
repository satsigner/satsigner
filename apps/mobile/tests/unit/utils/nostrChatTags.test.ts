import {
  buildMessageDeletionTags,
  buildReplyTag,
  buildSessionTag,
  buildSubjectTag,
  getDeletionTargetIds,
  getReplyToId,
  getSessionId,
  getSubject,
  isChatSessionId
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

describe('session tags', () => {
  const SESSION = 'c'.repeat(32)

  it('round-trips a session tag', () => {
    expect(getSessionId([['p', OTHER], buildSessionTag(SESSION)])).toBe(SESSION)
  })

  it('reads a missing tag as no session, so a reply can inherit one', () => {
    expect(getSessionId([['p', OTHER]])).toBeNull()
    expect(getSessionId(undefined)).toBeNull()
  })

  it('reads a malformed id as the default session', () => {
    expect(getSessionId([['session', 'C'.repeat(32)]])).toBe('')
    expect(getSessionId([['session', 'c'.repeat(31)]])).toBe('')
    expect(getSessionId([['session', `${SESSION}x`]])).toBe('')
    expect(getSessionId([['session', '']])).toBe('')
  })

  it('reads a session tag without a value as the default session', () => {
    expect(getSessionId([['session']])).toBe('')
  })

  it('accepts only 32 lowercase hex characters as a session id', () => {
    expect(isChatSessionId(SESSION)).toBe(true)
    expect(isChatSessionId('')).toBe(false)
    expect(isChatSessionId('g'.repeat(32))).toBe(false)
  })
})

describe('subject tags', () => {
  it('round-trips a subject', () => {
    expect(getSubject([buildSubjectTag('Release 1.4')])).toBe('Release 1.4')
  })

  it('flattens and caps a subject from a peer', () => {
    expect(getSubject([['subject', '  line one\n\nline two ']])).toBe(
      'line one line two'
    )
    expect(getSubject([['subject', 'x'.repeat(200)]])?.length).toBeLessThan(90)
  })

  it('ignores an empty subject', () => {
    expect(getSubject([['subject', '   ']])).toBeUndefined()
    expect(getSubject([])).toBeUndefined()
  })
})
