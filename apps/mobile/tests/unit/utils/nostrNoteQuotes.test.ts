import type { NostrFeedNoteLike } from '@/components/SSNostrFeedNoteRow'
import {
  collectUnresolvedEventIds,
  getQuoteTagEventIds,
  getRepostETagEventId,
  getResolvedEventId,
  hasEmbeddedEventRef,
  isNoteQuotePost,
  parseRepostOriginalEvent,
  stripNostrEventRefs
} from '@/utils/nostrNoteQuotes'

const EVENT_ID_A =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const EVENT_ID_B =
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const NOTE_BECH32_A_BARE =
  'note1424242424242424242424242424242424242424242424242424qv3q9y6'
const NOTE_BECH32_A = `nostr:${NOTE_BECH32_A_BARE}`

jest.mock<typeof import('nostr-tools')>('nostr-tools', () => ({
  nip19: {
    decode: jest.fn((str: string) => {
      if (str === NOTE_BECH32_A_BARE) {
        return { data: EVENT_ID_A, type: 'note' }
      }
      throw new Error('Invalid bech32')
    })
  }
}))

function note(overrides: Partial<NostrFeedNoteLike> = {}): NostrFeedNoteLike {
  return {
    content: '',
    created_at: 1700000000,
    id: EVENT_ID_A,
    kind: 1,
    pubkey: EVENT_ID_B,
    tags: [],
    ...overrides
  }
}

describe('nostrNoteQuotes', () => {
  describe('parseRepostOriginalEvent', () => {
    it('returns parsed event for valid JSON payload', () => {
      const payload = {
        content: 'hello',
        created_at: 1700000000,
        id: EVENT_ID_A,
        kind: 1,
        pubkey: EVENT_ID_B,
        tags: [['e', EVENT_ID_A]]
      }
      const parsed = parseRepostOriginalEvent(JSON.stringify(payload))
      expect(parsed).toStrictEqual(payload)
    })

    it('returns null for empty string', () => {
      expect(parseRepostOriginalEvent('')).toBeNull()
      expect(parseRepostOriginalEvent('   ')).toBeNull()
    })

    it('returns null for malformed JSON', () => {
      expect(parseRepostOriginalEvent('{not json')).toBeNull()
    })

    it('returns null when required fields are missing', () => {
      expect(
        parseRepostOriginalEvent(
          JSON.stringify({ id: EVENT_ID_A, kind: 1, tags: [] })
        )
      ).toBeNull()
    })

    it('returns null when required field has wrong type', () => {
      expect(
        parseRepostOriginalEvent(
          JSON.stringify({
            content: 'x',
            created_at: 'not a number',
            id: EVENT_ID_A,
            kind: 1,
            pubkey: EVENT_ID_B,
            tags: []
          })
        )
      ).toBeNull()
    })

    it('filters non-array tag entries', () => {
      const parsed = parseRepostOriginalEvent(
        JSON.stringify({
          content: 'x',
          created_at: 1,
          id: EVENT_ID_A,
          kind: 1,
          pubkey: EVENT_ID_B,
          tags: [['e', EVENT_ID_A], 'invalid', { also: 'invalid' }]
        })
      )
      expect(parsed?.tags).toStrictEqual([['e', EVENT_ID_A]])
    })
  })

  describe('getRepostETagEventId', () => {
    it('returns first e tag value', () => {
      expect(
        getRepostETagEventId([
          ['p', EVENT_ID_B],
          ['e', EVENT_ID_A]
        ])
      ).toBe(EVENT_ID_A)
    })

    it('returns null when no e tag', () => {
      expect(getRepostETagEventId([['p', EVENT_ID_B]])).toBeNull()
    })

    it('returns null when e tag has no value', () => {
      expect(getRepostETagEventId([['e']])).toBeNull()
    })
  })

  describe('getQuoteTagEventIds', () => {
    it('returns all q tag values', () => {
      expect(
        getQuoteTagEventIds([
          ['q', EVENT_ID_A],
          ['p', EVENT_ID_B],
          ['q', EVENT_ID_B]
        ])
      ).toStrictEqual([EVENT_ID_A, EVENT_ID_B])
    })

    it('returns empty array when no q tags', () => {
      expect(getQuoteTagEventIds([['e', EVENT_ID_A]])).toStrictEqual([])
    })
  })

  describe('hasEmbeddedEventRef', () => {
    it('returns true for nostr:note1 reference', () => {
      expect(hasEmbeddedEventRef(`see ${NOTE_BECH32_A}`)).toBe(true)
    })

    it('returns false when no reference', () => {
      expect(hasEmbeddedEventRef('plain text')).toBe(false)
    })

    it('is stateless across calls (regex lastIndex reset)', () => {
      const content = `see ${NOTE_BECH32_A}`
      expect(hasEmbeddedEventRef(content)).toBe(true)
      expect(hasEmbeddedEventRef(content)).toBe(true)
    })
  })

  describe('stripNostrEventRefs', () => {
    it('removes nostr event references and collapses whitespace', () => {
      expect(stripNostrEventRefs(`see ${NOTE_BECH32_A} now`)).toBe('see now')
    })

    it('returns trimmed content when no references', () => {
      expect(stripNostrEventRefs('  plain text  ')).toBe('plain text')
    })
  })

  describe('isNoteQuotePost', () => {
    it('returns true when kind 1 has q tag', () => {
      expect(
        isNoteQuotePost(note({ kind: 1, tags: [['q', EVENT_ID_A]] }))
      ).toBe(true)
    })

    it('returns true when kind 1 has embedded ref', () => {
      expect(
        isNoteQuotePost(note({ content: `ref ${NOTE_BECH32_A}`, kind: 1 }))
      ).toBe(true)
    })

    it('returns false for non-kind-1', () => {
      expect(
        isNoteQuotePost(note({ kind: 6, tags: [['q', EVENT_ID_A]] }))
      ).toBe(false)
    })

    it('returns false for kind 1 without quote/ref', () => {
      expect(isNoteQuotePost(note({ kind: 1 }))).toBe(false)
    })
  })

  describe('getResolvedEventId', () => {
    it('returns null for repost with parseable content', () => {
      const inner = JSON.stringify({
        content: 'x',
        created_at: 1,
        id: EVENT_ID_A,
        kind: 1,
        pubkey: EVENT_ID_B,
        tags: []
      })
      expect(getResolvedEventId(note({ content: inner, kind: 6 }))).toBeNull()
    })

    it('returns e tag fallback for repost with empty content', () => {
      expect(
        getResolvedEventId(
          note({ content: '', kind: 6, tags: [['e', EVENT_ID_A]] })
        )
      ).toBe(EVENT_ID_A)
    })

    it('returns first q tag for kind 1', () => {
      expect(
        getResolvedEventId(
          note({
            kind: 1,
            tags: [
              ['q', EVENT_ID_A],
              ['q', EVENT_ID_B]
            ]
          })
        )
      ).toBe(EVENT_ID_A)
    })

    it('decodes embedded ref when no q tag', () => {
      const id = getResolvedEventId(
        note({ content: `quote: ${NOTE_BECH32_A}`, kind: 1 })
      )
      expect(id).toBe(EVENT_ID_A)
    })

    it('returns null for kind outside 1/6/16', () => {
      expect(getResolvedEventId(note({ kind: 4 }))).toBeNull()
    })
  })

  describe('collectUnresolvedEventIds', () => {
    it('collects fallback e tag id for repost with empty content', () => {
      const result = collectUnresolvedEventIds(
        [note({ content: '', kind: 6, tags: [['e', EVENT_ID_A]] })],
        new Set()
      )
      expect(result).toStrictEqual([EVENT_ID_A])
    })

    it('skips ids already resolved', () => {
      const result = collectUnresolvedEventIds(
        [note({ content: '', kind: 6, tags: [['e', EVENT_ID_A]] })],
        new Set([EVENT_ID_A])
      )
      expect(result).toStrictEqual([])
    })

    it('collects q tag ids from kind 1', () => {
      const result = collectUnresolvedEventIds(
        [note({ kind: 1, tags: [['q', EVENT_ID_A]] })],
        new Set()
      )
      expect(result).toStrictEqual([EVENT_ID_A])
    })

    it('decodes embedded refs when no q tag', () => {
      const result = collectUnresolvedEventIds(
        [note({ content: NOTE_BECH32_A, kind: 1 })],
        new Set()
      )
      expect(result).toStrictEqual([EVENT_ID_A])
    })

    it('deduplicates ids across notes', () => {
      const result = collectUnresolvedEventIds(
        [
          note({ kind: 1, tags: [['q', EVENT_ID_A]] }),
          note({ id: EVENT_ID_B, kind: 1, tags: [['q', EVENT_ID_A]] })
        ],
        new Set()
      )
      expect(result).toStrictEqual([EVENT_ID_A])
    })
  })
})
