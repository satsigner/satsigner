import { formatAddress, formatNumber } from '@/utils/format'

describe('format utils', () => {
  describe('formatAddress', () => {
    it('should return an address with 16 or less characters', () => {
      expect(formatAddress('hi@satsigner.com')).toBe('hi@satsigner.com')
    })

    it('should return first and last eight characters of the address', () => {
      expect(formatAddress('1111111111111111111114oLvT2')).toBe(
        '11111111...114oLvT2'
      )
    })
  })

  describe('formatNumber', () => {
    it('should return the correct localized number with no decimals', () => {
      expect(formatNumber(3000)).toBe('3,000')
      expect(formatNumber(1000000)).toBe('1,000,000')
    })

    it('should return the correct localized number with decimals', () => {
      expect(formatNumber(0.795, 2)).toBe('0.80')
    })
  })
})
