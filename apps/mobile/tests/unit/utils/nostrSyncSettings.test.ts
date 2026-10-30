import {
  hasCommonNostrKeys,
  kind0ProfileWithContent
} from '@/utils/nostrSyncSettings'

describe('nostrSyncSettings', () => {
  describe('kind0ProfileWithContent', () => {
    it('returns null when there is no profile', () => {
      expect(kind0ProfileWithContent(null)).toBeNull()
      expect(kind0ProfileWithContent(undefined)).toBeNull()
    })

    it('returns null when the profile has neither a name nor a picture', () => {
      expect(kind0ProfileWithContent({})).toBeNull()
      expect(
        kind0ProfileWithContent({
          displayName: '',
          nip05: 'a@b.c',
          picture: ''
        })
      ).toBeNull()
    })

    it('returns the same profile when it has a name or a picture', () => {
      const named = { displayName: 'Alice' }
      const pictured = { picture: 'https://example.com/a.png' }
      expect(kind0ProfileWithContent(named)).toBe(named)
      expect(kind0ProfileWithContent(pictured)).toBe(pictured)
    })
  })

  describe('hasCommonNostrKeys', () => {
    it('rejects a missing result', () => {
      expect(hasCommonNostrKeys(undefined)).toBe(false)
    })

    it('rejects an object without both common keys', () => {
      expect(hasCommonNostrKeys({ commonNsec: 'nsec1' })).toBe(false)
      expect(hasCommonNostrKeys({ commonNpub: 'npub1' })).toBe(false)
    })

    it('accepts an object with both common keys', () => {
      expect(
        hasCommonNostrKeys({ commonNpub: 'npub1', commonNsec: 'nsec1' })
      ).toBe(true)
    })
  })
})
