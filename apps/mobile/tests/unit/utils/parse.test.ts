import {
  parseLabel,
  parseLabelTags,
  parseUriParameters,
  stripBitcoinPrefix
} from '@/utils/parse'

describe('parse utils', () => {
  describe('stripBitcoinPrefix', () => {
    it('should strip lowercase bitcoin: prefix', () => {
      expect(stripBitcoinPrefix('bitcoin:abc123')).toBe('abc123')
    })

    it('should strip uppercase BITCOIN: prefix', () => {
      expect(stripBitcoinPrefix('BITCOIN:abc123')).toBe('abc123')
    })

    it('should strip mixed case Bitcoin: prefix', () => {
      expect(stripBitcoinPrefix('Bitcoin:abc123')).toBe('abc123')
    })

    it('should return original string if no prefix', () => {
      expect(stripBitcoinPrefix('abc123')).toBe('abc123')
    })

    it('should handle empty string', () => {
      expect(stripBitcoinPrefix('')).toBe('')
    })

    it('should handle address with query params', () => {
      expect(stripBitcoinPrefix('bitcoin:abc123?amount=1.5')).toBe(
        'abc123?amount=1.5'
      )
    })
  })

  describe('parseUriParameters', () => {
    it('should parse address without parameters', () => {
      const result = parseUriParameters('bc1qtest123')
      expect(result).toEqual({ address: 'bc1qtest123' })
    })

    it('should parse address with amount', () => {
      const result = parseUriParameters('bc1qtest123?amount=1.5')
      expect(result).toEqual({
        address: 'bc1qtest123',
        amount: 1.5,
        label: undefined
      })
    })

    it('should parse address with label', () => {
      const result = parseUriParameters('bc1qtest123?label=Test%20Payment')
      expect(result).toEqual({
        address: 'bc1qtest123',
        amount: undefined,
        label: 'Test Payment'
      })
    })

    it('should parse address with amount and label', () => {
      const result = parseUriParameters(
        'bc1qtest123?amount=0.001&label=Coffee'
      )
      expect(result).toEqual({
        address: 'bc1qtest123',
        amount: 0.001,
        label: 'Coffee'
      })
    })

    it('should return null for empty string', () => {
      const result = parseUriParameters('')
      expect(result).toBeNull()
    })

    it('should handle address with empty query string', () => {
      const result = parseUriParameters('bc1qtest123?')
      expect(result).toEqual({
        address: 'bc1qtest123',
        amount: undefined,
        label: undefined
      })
    })
  })


  describe('parseLabel', () => {
    it('should return label with no tags', () => {
      const result = parseLabel('Test label')
      expect(result.label).toBe('Test label')
      expect(result.tags).toHaveLength(0)
    })

    it('should return label with tags', () => {
      const result = parseLabel('Test label #kyc #satsigner')
      expect(result.label).toBe('Test label')
      expect(result.tags).toEqual(['kyc', 'satsigner'])
    })
  })

  describe('parseLabelTags', () => {
    it('should return only label', () => {
      const result = parseLabelTags('My label', [])
      expect(result).toBe('My label')
    })
    it('should return label and tags', () => {
      const result = parseLabelTags('My label', ['endthefed', 'nokyc'])
      expect(result).toBe('My label #endthefed #nokyc')
    })
    it('should return only tags', () => {
      const result = parseLabelTags('', ['endthefed', 'nokyc'])
      expect(result).toBe('#endthefed #nokyc')
    })
  })
})
