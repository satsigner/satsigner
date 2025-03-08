import { estimateTransactionSize } from '../../utils/transaction'

describe('Transaction Utils', () => {
  describe('estimateTransactionSize', () => {
    it('should correctly calculate transaction size for 1 input and 1 output', () => {
      const result = estimateTransactionSize(1, 1)
      expect(result.size).toBe(192) // 10 + (1 * 148) + (1 * 34)
      expect(result.vsize).toBe(48) // ceil(192 * 0.25)
    })

    it('should correctly calculate transaction size for multiple inputs and outputs', () => {
      const result = estimateTransactionSize(2, 3)
      expect(result.size).toBe(408) // 10 + (2 * 148) + (3 * 34)
      expect(result.vsize).toBe(102) // ceil(408 * 0.25)
    })

    it('should correctly calculate transaction size for zero inputs and outputs', () => {
      const result = estimateTransactionSize(0, 0)
      expect(result.size).toBe(10) // base size only
      expect(result.vsize).toBe(3) // ceil(10 * 0.25)
    })
  })
})
