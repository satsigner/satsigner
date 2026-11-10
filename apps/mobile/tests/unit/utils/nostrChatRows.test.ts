import { type NostrDM } from '@/types/models/Nostr'
import {
  buildChatRows,
  buildReplyPreview,
  findRowIndex,
  formatChatDayLabel,
  startOfLocalDay
} from '@/utils/nostrChatRows'

const DAY = 24 * 60 * 60
const BASE = Math.floor(new Date(2026, 0, 15, 12, 0, 0).getTime() / 1000)

function dm(
  id: string,
  author: string,
  createdAt: number,
  extra = {}
): NostrDM {
  return {
    author,
    content: { created_at: createdAt, description: id },
    created_at: createdAt,
    description: `text ${id}`,
    event: '',
    id,
    label: 1,
    ...extra
  }
}

function identity(item: NostrDM) {
  return item
}

describe('buildChatRows', () => {
  it('starts with a day separator and groups the same author', () => {
    const rows = buildChatRows(
      [dm('a', 'alice', BASE), dm('b', 'alice', BASE + 60)],
      identity
    )

    expect(rows.map((row) => row.kind)).toStrictEqual([
      'day',
      'message',
      'message'
    ])
    expect(rows[1]).toMatchObject({ isContinuation: false, key: 'a' })
    expect(rows[2]).toMatchObject({ isContinuation: true, key: 'b' })
  })

  it('breaks the group on a new author or after the window', () => {
    const rows = buildChatRows(
      [
        dm('a', 'alice', BASE),
        dm('b', 'bob', BASE + 30),
        dm('c', 'bob', BASE + 30 + 60 * 60)
      ],
      identity
    ).filter((row) => row.kind === 'message')

    expect(rows.map((row) => row.isContinuation)).toStrictEqual([
      false,
      false,
      false
    ])
  })

  it('adds a separator for each new day', () => {
    const rows = buildChatRows(
      [dm('a', 'alice', BASE), dm('b', 'alice', BASE + DAY)],
      identity
    )

    expect(rows.map((row) => row.kind)).toStrictEqual([
      'day',
      'message',
      'day',
      'message'
    ])
    expect(rows[3]).toMatchObject({ isContinuation: false })
  })

  it('never folds a reply into the previous message', () => {
    const rows = buildChatRows(
      [dm('a', 'alice', BASE), dm('b', 'alice', BASE + 5, { replyToId: 'x' })],
      identity
    )

    expect(rows[2]).toMatchObject({ isContinuation: false })
  })

  it('finds the row of a message', () => {
    const rows = buildChatRows([dm('a', 'alice', BASE)], identity)

    expect(findRowIndex(rows, 'a')).toBe(1)
    expect(findRowIndex(rows, 'missing')).toBe(-1)
  })
})

describe('buildReplyPreview', () => {
  it('quotes the parent on one line', () => {
    const parent = dm('p', 'alice', BASE, { description: 'line one\nline two' })

    expect(buildReplyPreview('p', new Map([['p', parent]]))).toStrictEqual({
      authorKey: 'alice',
      parentId: 'p',
      text: 'line one line two'
    })
  })

  it('truncates long parents', () => {
    const parent = dm('p', 'alice', BASE, { description: 'x'.repeat(500) })
    const { text } = buildReplyPreview('p', new Map([['p', parent]]))

    expect(text?.endsWith('…')).toBe(true)
    expect(text?.length).toBeLessThan(200)
  })

  it('has no text when the parent is not loaded', () => {
    expect(buildReplyPreview('p', new Map()).text).toBeNull()
  })
})

describe('formatChatDayLabel', () => {
  const todayStart = startOfLocalDay(BASE)

  it('names today and yesterday', () => {
    expect(formatChatDayLabel(todayStart, todayStart)).toBe('Today')
    expect(formatChatDayLabel(startOfLocalDay(BASE - DAY), todayStart)).toBe(
      'Yesterday'
    )
  })

  it('dates older days', () => {
    expect(
      formatChatDayLabel(startOfLocalDay(BASE - 3 * DAY), todayStart)
    ).toContain('2026')
  })
})
