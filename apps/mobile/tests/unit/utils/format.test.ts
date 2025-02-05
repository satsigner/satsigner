import {
  formatAddress,
  formatDate,
  formatLabel,
  formatLabelTags,
  formatNumber,
  formatTime
} from '@/utils/format'

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

    it('should return the correct number with padding', () => {
      expect(formatNumber(210000, 0, true)).toBe('0.00 210 000')
      expect(formatNumber(123456789, 0, true)).toBe('1.23 456 789')
    })
  })

  describe('formatTime', () => {
    it('should return the correct formatted time', () => {
      expect(formatTime(new Date(1231006505000))).toBe('6:15pm')
    })
  })

  describe('formatDate', () => {
    it('should return the correct formatted date', () => {
      expect(formatDate(new Date(1231006505000))).toBe('Jan 3, 2009')
    })

    it('should work with string date', () => {
      expect(formatDate('2024-03-28T11:51:36.000Z')).toBe('Mar 28, 2024')
    })

    it('should work with number date', () => {
      expect(formatDate(1711639918000)).toBe('Mar 28, 2024')
    })
  })

  describe('formatLabel', () => {
    it('should return label with no tags', () => {
      const result = formatLabel('Test label')
      expect(result.label).toBe('Test label')
      expect(result.tags).toHaveLength(0)
    })

    it('should return label with tags', () => {
      const result = formatLabel('Test label #kyc #satsigner')
      expect(result.label).toBe('Test label')
      expect(result.tags).toEqual(['kyc', 'satsigner'])
    })
  })

  describe('formatLabelTags', () => {
    it('should return only label', () => {
      const result = formatLabelTags('My label', [])
      expect(result).toBe('My label')
    })
    it('should return label and tags', () => {
      const result = formatLabelTags('My label', ['endthefed', 'nokyc'])
      expect(result).toBe('My label #endthefed #nokyc')
    })
    it('should return only tags', () => {
      const result = formatLabelTags('', ['endthefed', 'nokyc'])
      expect(result).toBe('#endthefed #nokyc')
    })
  })
})
