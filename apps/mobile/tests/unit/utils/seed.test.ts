import { getConfirmWordCandidates } from '@/utils/seed'

describe('seed utils', () => {
  describe('getConfirmWordCandidates', () => {
    it('should return a 3 word shuffled list', () => {
      const seedWords = [
        'sponsor',
        'duty',
        'eyebrow',
        'defense',
        'poverty',
        'client',
        'effort',
        'simple',
        'risk',
        'sauce',
        'what',
        'surface'
      ]

      const candidates = getConfirmWordCandidates(seedWords[0], seedWords)

      expect(candidates).toHaveLength(3)
      expect(candidates[0]).not.toBe(candidates[1])
      expect(candidates[1]).not.toBe(candidates[2])
      expect(candidates[0]).not.toBe(candidates[2])
    })
  })
})
