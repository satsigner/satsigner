import { compareAmount, compareTimestamp } from '@/utils/sort'

describe('sort utils', () => {
  describe('compareTimestamp', () => {
    it('should return correct timestamp sort order', () => {
      const date1 = new Date('January 03, 2009')
      const date2 = new Date('January 04, 2009')

      expect(compareTimestamp(date1, date2)).toBeLessThan(0)
      expect(compareTimestamp(date1, date1)).toBe(0)
      expect(compareTimestamp(date2, date1)).toBeGreaterThan(0)
    })
  })

  describe('compareAmount', () => {
    it('should return correct amount sort order', () => {
      const amount1 = 21
      const amount2 = 21_000_000

      expect(compareAmount(amount1, amount2)).toBeLessThan(0)
      expect(compareAmount(amount1, amount1)).toBe(0)
      expect(compareAmount(amount2, amount1)).toBeGreaterThan(0)
    })
  })
})
