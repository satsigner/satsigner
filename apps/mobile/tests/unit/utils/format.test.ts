import { formatAddress } from '@/utils/format'

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
})
