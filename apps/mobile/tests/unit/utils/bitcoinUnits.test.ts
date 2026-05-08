import { millisatsToSats } from '@/utils/bitcoinUnits'

describe('bitcoinUnits', () => {
  describe('millisatsToSats', () => {
    it('rounds up with ceil mode', () => {
      expect(millisatsToSats(3000, 'ceil')).toBe(3)
      expect(millisatsToSats(3001, 'ceil')).toBe(4)
      expect(millisatsToSats(1, 'ceil')).toBe(1)
    })

    it('rounds down with floor mode', () => {
      expect(millisatsToSats(3000, 'floor')).toBe(3)
      expect(millisatsToSats(3999, 'floor')).toBe(3)
      expect(millisatsToSats(999, 'floor')).toBe(0)
    })

    it('handles zero', () => {
      expect(millisatsToSats(0, 'ceil')).toBe(0)
      expect(millisatsToSats(0, 'floor')).toBe(0)
    })

    it('handles large values without precision loss', () => {
      expect(millisatsToSats(10_000_000_000, 'floor')).toBe(10_000_000)
      expect(millisatsToSats(10_000_000_000, 'ceil')).toBe(10_000_000)
    })
  })
})
