import {
  isNostrTags,
  isSignedNdkEvent,
  parseNostrEvent,
  parseNostrEventTemplate,
  parseNostrRumor
} from '@/utils/nostrEvent'

const PUBKEY = 'a'.repeat(64)
const EVENT_ID = 'b'.repeat(64)
const SIG = 'c'.repeat(128)

const template = {
  content: 'hello',
  created_at: 1700000000,
  kind: 1,
  tags: [['p', PUBKEY]]
}

const signedEvent = { ...template, id: EVENT_ID, pubkey: PUBKEY, sig: SIG }

describe('nostrEvent', () => {
  describe('isNostrTags', () => {
    it('accepts lists of string lists', () => {
      expect(isNostrTags([])).toBe(true)
      expect(isNostrTags([['e', EVENT_ID], ['t']])).toBe(true)
    })

    it('rejects anything else', () => {
      expect(isNostrTags([['amount', 1000]])).toBe(false)
      expect(isNostrTags(['e', EVENT_ID])).toBe(false)
      expect(isNostrTags([null])).toBe(false)
      expect(isNostrTags({})).toBe(false)
      expect(isNostrTags(undefined)).toBe(false)
    })
  })

  describe('parseNostrEventTemplate', () => {
    it('keeps only the template fields', () => {
      expect(
        parseNostrEventTemplate({ ...signedEvent, extra: 'dropped' })
      ).toStrictEqual(template)
    })

    it('returns null when a field is missing or has the wrong type', () => {
      expect(
        parseNostrEventTemplate({ ...template, created_at: undefined })
      ).toBeNull()
      expect(parseNostrEventTemplate({ ...template, kind: '1' })).toBeNull()
      expect(
        parseNostrEventTemplate({ ...template, tags: [['p', 1]] })
      ).toBeNull()
      expect(parseNostrEventTemplate('not an event')).toBeNull()
    })
  })

  describe('parseNostrEvent', () => {
    it('parses a signed event', () => {
      expect(parseNostrEvent(signedEvent)).toStrictEqual(signedEvent)
    })

    it('returns null when a signed field is missing', () => {
      expect(parseNostrEvent(template)).toBeNull()
      expect(parseNostrEvent({ ...signedEvent, sig: undefined })).toBeNull()
      expect(parseNostrEvent(null)).toBeNull()
    })
  })

  describe('parseNostrRumor', () => {
    it('keeps fields beyond the checked ones', () => {
      const rumor = { ...template, id: EVENT_ID, kind: 14, pubkey: PUBKEY }
      expect(parseNostrRumor(rumor)).toStrictEqual(rumor)
    })

    it('accepts a rumor without created_at', () => {
      expect(
        parseNostrRumor({ content: 'hi', id: EVENT_ID, pubkey: PUBKEY })
      ).toStrictEqual({ content: 'hi', id: EVENT_ID, pubkey: PUBKEY })
    })

    it('returns null for malformed rumors', () => {
      expect(parseNostrRumor({ content: 'hi', pubkey: PUBKEY })).toBeNull()
      expect(
        parseNostrRumor({ content: 1, id: EVENT_ID, pubkey: PUBKEY })
      ).toBeNull()
      expect(
        parseNostrRumor({
          content: 'hi',
          created_at: '1700000000',
          id: EVENT_ID,
          pubkey: PUBKEY
        })
      ).toBeNull()
      expect(parseNostrRumor([])).toBeNull()
    })
  })

  describe('isSignedNdkEvent', () => {
    it('accepts events with id, sig and kind', () => {
      expect(isSignedNdkEvent(signedEvent)).toBe(true)
    })

    it('rejects unsigned events', () => {
      expect(isSignedNdkEvent({ ...signedEvent, sig: undefined })).toBe(false)
      expect(isSignedNdkEvent({ ...signedEvent, id: '' })).toBe(false)
      expect(isSignedNdkEvent({ ...signedEvent, kind: undefined })).toBe(false)
    })
  })
})
