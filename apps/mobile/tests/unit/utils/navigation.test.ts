import { showNavigation } from '@/utils/navigation'

describe('navigation utils', () => {
  describe('showNavigation', () => {
    it('returns true for root path', () => {
      expect(showNavigation('/', 0)).toBe(true)
    })

    it('returns false for settings screen', () => {
      expect(showNavigation('/settings', 1)).toBe(false)
    })

    it('returns false when depth exceeds 4', () => {
      expect(showNavigation('/signer/bitcoin/account/123/settings', 5)).toBe(
        false
      )
    })
  })
})
