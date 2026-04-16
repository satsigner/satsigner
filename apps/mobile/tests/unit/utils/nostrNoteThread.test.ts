import {
  getRelayHintForEventId,
  getReplyParentEventIdHex,
  noteLooksLikeReply
} from '@/utils/nostrNoteThread'

const ROOT =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const PARENT =
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const OTHER =
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'

describe('nostrNoteThread', () => {
  describe('getReplyParentEventIdHex', () => {
    it('returns e tag marked reply', () => {
      const tags: string[][] = [
        ['e', ROOT, 'wss://a.example', 'root'],
        ['e', PARENT, 'wss://b.example', 'reply']
      ]
      expect(noteLooksLikeReply(tags)).toBe(true)
      expect(getReplyParentEventIdHex(tags)).toBe(PARENT)
    })

    it('returns last e tag when multiple without markers (legacy)', () => {
      const tags: string[][] = [
        ['e', ROOT, 'wss://a.example', ''],
        ['e', PARENT, '', '']
      ]
      expect(noteLooksLikeReply(tags)).toBe(true)
      expect(getReplyParentEventIdHex(tags)).toBe(PARENT)
    })

    it('returns null for single root marker', () => {
      const tags: string[][] = [['e', ROOT, 'wss://a.example', 'root']]
      expect(noteLooksLikeReply(tags)).toBe(false)
      expect(getReplyParentEventIdHex(tags)).toBe(null)
    })

    it('returns single e id when one non-root reply', () => {
      const tags: string[][] = [['e', PARENT, '', '']]
      expect(noteLooksLikeReply(tags)).toBe(true)
      expect(getReplyParentEventIdHex(tags)).toBe(PARENT)
    })
  })

  describe('getRelayHintForEventId', () => {
    it('returns relay url for matching e tag', () => {
      const tags: string[][] = [
        ['e', OTHER, '', ''],
        ['e', PARENT, 'wss://relay.example/nostr', 'reply']
      ]
      expect(getRelayHintForEventId(tags, PARENT)).toBe(
        'wss://relay.example/nostr'
      )
    })

    it('returns undefined when no ws hint', () => {
      const tags: string[][] = [['e', PARENT, '', 'reply']]
      expect(getRelayHintForEventId(tags, PARENT)).toBeUndefined()
    })
  })
})
