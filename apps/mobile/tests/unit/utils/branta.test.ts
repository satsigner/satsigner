import {
  hasBrantaZkQueryParams,
  isBrantaLookupContent,
  isBrantaVerificationEnabled,
  shouldAutoPrefetchLogo,
  shouldAutoVerify,
  shouldShowLogoPrefetchButton,
  shouldShowVerifyButton
} from '@/utils/branta'

describe('branta utils', () => {
  describe('isBrantaVerificationEnabled', () => {
    it('returns false only for off mode', () => {
      expect(isBrantaVerificationEnabled('off')).toBe(false)
      expect(isBrantaVerificationEnabled('auto')).toBe(true)
      expect(isBrantaVerificationEnabled('on_request')).toBe(true)
    })
  })

  describe('trigger modes', () => {
    it('maps verification modes', () => {
      expect(shouldAutoVerify('auto')).toBe(true)
      expect(shouldAutoVerify('on_request')).toBe(false)
      expect(shouldShowVerifyButton('on_request')).toBe(true)
      expect(shouldShowVerifyButton('auto')).toBe(false)
    })

    it('maps logo prefetch modes', () => {
      expect(shouldAutoPrefetchLogo('auto')).toBe(true)
      expect(shouldShowLogoPrefetchButton('on_request')).toBe(true)
      expect(shouldShowLogoPrefetchButton('off')).toBe(false)
    })
  })

  describe('hasBrantaZkQueryParams', () => {
    it('detects branta zk query params', () => {
      expect(
        hasBrantaZkQueryParams(
          'bitcoin:bc1qexample?amount=1&branta_id=abc&branta_secret=def'
        )
      ).toBe(true)
      expect(hasBrantaZkQueryParams('bitcoin:bc1qexample?amount=1')).toBe(
        false
      )
    })
  })

  describe('isBrantaLookupContent', () => {
    it('accepts supported payment destinations', () => {
      expect(isBrantaLookupContent('lnbc1example')).toBe(true)
      expect(isBrantaLookupContent('bitcoin:bc1qexample')).toBe(true)
      expect(isBrantaLookupContent('ark1example')).toBe(true)
      expect(isBrantaLookupContent('user@domain.com')).toBe(true)
      expect(isBrantaLookupContent('')).toBe(false)
    })
  })
})
