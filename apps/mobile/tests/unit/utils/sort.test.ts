import { compareAmount, compareTimestamp } from '@/utils/sort'

describe('sort utils', () => {
  describe('compareTimestamp', () => {
    it('should return correct timestamp sort order', () => {
      const date1 = new Date('January 03, 2009')
      const date2 = new Date('January 04, 2009')

      expect(compareTimestamp(date1, date2)).toBeLessThan(0)
      expect(compareTimestamp(date1, date1)).toBe(0)
      expect(compareTimestamp(date2, date1)).toBeGreaterThan(0)

      const date3 = '2024-05-30T13:38:59.281Z'
      const date4 = '2024-05-31T13:38:59.281Z'

      expect(compareTimestamp(date3, date4)).toBeLessThan(0)
      expect(compareTimestamp(date3, date3)).toBe(0)
      expect(compareTimestamp(date4, date3)).toBeGreaterThan(0)
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
