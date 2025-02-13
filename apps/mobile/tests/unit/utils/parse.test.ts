import { parseLabel, parseLabelTags } from '@/utils/parse'

describe('parse utils', () => {
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
