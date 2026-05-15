import {
  applyBookmarkUpdate,
  decryptPrivateBookmarks,
  encryptPrivateBookmarks,
  mergeBookmarks,
  parsePublicBookmarks
} from '@/utils/nostrBookmarks'

jest.mock<typeof import('nostr-tools/nip04')>('nostr-tools/nip04', () => ({
  decrypt: jest.fn(
    (_sk: Uint8Array, _pk: string, ciphertext: string) => ciphertext
  ),
  encrypt: jest.fn(
    (_sk: Uint8Array, _pk: string, plaintext: string) => plaintext
  )
}))

const EVENT_A =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const EVENT_B =
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EVENT_C =
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const PUBKEY =
  'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'

const SECRET = new Uint8Array(32)

describe('nostrBookmarks', () => {
  describe('parsePublicBookmarks', () => {
    it('extracts e tags with 64-char values', () => {
      expect(
        parsePublicBookmarks([
          ['e', EVENT_A],
          ['p', PUBKEY],
          ['e', EVENT_B]
        ])
      ).toStrictEqual([
        { eventId: EVENT_A, source: 'public' },
        { eventId: EVENT_B, source: 'public' }
      ])
    })

    it('skips e tags with wrong length', () => {
      expect(parsePublicBookmarks([['e', 'short']])).toStrictEqual([])
    })

    it('skips non-e tags', () => {
      expect(parsePublicBookmarks([['p', PUBKEY]])).toStrictEqual([])
    })
  })

  describe('decryptPrivateBookmarks', () => {
    it('returns empty array for empty content', () => {
      expect(decryptPrivateBookmarks('', SECRET, PUBKEY)).toStrictEqual([])
    })

    it('decodes and filters tags after decrypt', () => {
      const ciphertext = JSON.stringify([
        ['e', EVENT_A],
        ['p', PUBKEY],
        ['e', EVENT_B],
        ['e', 'invalid']
      ])
      expect(decryptPrivateBookmarks(ciphertext, SECRET, PUBKEY)).toStrictEqual(
        [
          { eventId: EVENT_A, source: 'private' },
          { eventId: EVENT_B, source: 'private' }
        ]
      )
    })

    it('returns empty array on malformed JSON', () => {
      expect(decryptPrivateBookmarks('not json', SECRET, PUBKEY)).toStrictEqual(
        []
      )
    })
  })

  describe('mergeBookmarks', () => {
    it('keeps public entries first, dedupes private', () => {
      const pub = [{ eventId: EVENT_A, source: 'public' as const }]
      const priv = [
        { eventId: EVENT_A, source: 'private' as const },
        { eventId: EVENT_B, source: 'private' as const }
      ]
      expect(mergeBookmarks(pub, priv)).toStrictEqual([
        { eventId: EVENT_A, source: 'public' },
        { eventId: EVENT_B, source: 'private' }
      ])
    })

    it('preserves order within each list', () => {
      const pub = [
        { eventId: EVENT_B, source: 'public' as const },
        { eventId: EVENT_A, source: 'public' as const }
      ]
      expect(mergeBookmarks(pub, [])).toStrictEqual([
        { eventId: EVENT_B, source: 'public' },
        { eventId: EVENT_A, source: 'public' }
      ])
    })
  })

  describe('encryptPrivateBookmarks', () => {
    it('returns empty string for no event ids', () => {
      expect(encryptPrivateBookmarks([], SECRET, PUBKEY)).toBe('')
    })

    it('encrypts JSON-encoded e tags', () => {
      const result = encryptPrivateBookmarks([EVENT_A, EVENT_B], SECRET, PUBKEY)
      expect(JSON.parse(result)).toStrictEqual([
        ['e', EVENT_A],
        ['e', EVENT_B]
      ])
    })
  })

  describe('applyBookmarkUpdate', () => {
    it('adds first public bookmark when no existing', () => {
      const result = applyBookmarkUpdate(
        null,
        { eventId: EVENT_A, source: 'public', type: 'add' },
        null,
        PUBKEY
      )
      expect(result.tags).toStrictEqual([['e', EVENT_A]])
      expect(result.content).toBe('')
    })

    it('adds first private bookmark when secret provided', () => {
      const result = applyBookmarkUpdate(
        null,
        { eventId: EVENT_A, source: 'private', type: 'add' },
        SECRET,
        PUBKEY
      )
      expect(result.tags).toStrictEqual([])
      expect(JSON.parse(result.content)).toStrictEqual([['e', EVENT_A]])
    })

    it('moves bookmark from private to public on public add', () => {
      const existing = {
        content: JSON.stringify([['e', EVENT_A]]),
        tags: [['e', EVENT_B]]
      }
      const result = applyBookmarkUpdate(
        existing,
        { eventId: EVENT_A, source: 'public', type: 'add' },
        SECRET,
        PUBKEY
      )
      const tagIds = result.tags.map((t) => t[1])
      expect(tagIds).toContain(EVENT_A)
      expect(tagIds).toContain(EVENT_B)
      expect(result.content).toBe('')
    })

    it('moves bookmark from public to private on private add', () => {
      const existing = {
        content: '',
        tags: [
          ['e', EVENT_A],
          ['e', EVENT_B]
        ]
      }
      const result = applyBookmarkUpdate(
        existing,
        { eventId: EVENT_A, source: 'private', type: 'add' },
        SECRET,
        PUBKEY
      )
      expect(result.tags).toStrictEqual([['e', EVENT_B]])
      expect(JSON.parse(result.content)).toStrictEqual([['e', EVENT_A]])
    })

    it('removes from both public and private on remove', () => {
      const existing = {
        content: JSON.stringify([['e', EVENT_B]]),
        tags: [['e', EVENT_A]]
      }
      const result = applyBookmarkUpdate(
        existing,
        { eventId: EVENT_A, type: 'remove' },
        SECRET,
        PUBKEY
      )
      expect(result.tags).toStrictEqual([])
      expect(JSON.parse(result.content)).toStrictEqual([['e', EVENT_B]])
    })

    it('removes private entry when removing a private bookmark', () => {
      const existing = {
        content: JSON.stringify([
          ['e', EVENT_A],
          ['e', EVENT_B]
        ]),
        tags: [] as string[][]
      }
      const result = applyBookmarkUpdate(
        existing,
        { eventId: EVENT_A, type: 'remove' },
        SECRET,
        PUBKEY
      )
      expect(result.tags).toStrictEqual([])
      expect(JSON.parse(result.content)).toStrictEqual([['e', EVENT_B]])
    })

    it('clears content when no private entries remain', () => {
      const existing = {
        content: JSON.stringify([['e', EVENT_A]]),
        tags: [['e', EVENT_C]]
      }
      const result = applyBookmarkUpdate(
        existing,
        { eventId: EVENT_A, type: 'remove' },
        SECRET,
        PUBKEY
      )
      expect(result.tags).toStrictEqual([['e', EVENT_C]])
      expect(result.content).toBe('')
    })
  })
})
