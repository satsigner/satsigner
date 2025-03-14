import {
  estimateTransactionSize,
  recalculateDepthH
} from '../../../utils/transaction'

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

  describe('recalculateDepthH', () => {
    type TestTransaction = {
      txid: string
      vin: { txid: string; vout: number }[]
      vout?: { value: number; scriptpubkey_address: string }[]
      depthH: number
    }

    it('should set depthH to 1 for transactions with no dependencies', () => {
      const transactions = new Map<string, TestTransaction>([
        ['tx1', { txid: 'tx1', vin: [], vout: [], depthH: 0 }],
        ['tx2', { txid: 'tx2', vin: [], vout: [], depthH: 0 }]
      ])

      const result = recalculateDepthH(transactions)
      expect(result.get('tx1')?.depthH).toBe(1)
      expect(result.get('tx2')?.depthH).toBe(1)
    })

    it('should calculate correct depthH for transactions with dependencies', () => {
      const transactions = new Map<string, TestTransaction>([
        ['tx1', { txid: 'tx1', vin: [], vout: [], depthH: 0 }],
        [
          'tx2',
          { txid: 'tx2', vin: [{ txid: 'tx1', vout: 0 }], vout: [], depthH: 0 }
        ],
        [
          'tx3',
          { txid: 'tx3', vin: [{ txid: 'tx2', vout: 0 }], vout: [], depthH: 0 }
        ]
      ])

      const result = recalculateDepthH(transactions)
      expect(result.get('tx1')?.depthH).toBe(1)
      expect(result.get('tx2')?.depthH).toBe(3) // tx1's depthH (1) + 2
      expect(result.get('tx3')?.depthH).toBe(5) // tx2's depthH (3) + 2
    })

    it('should handle circular dependencies gracefully', () => {
      const transactions = new Map<string, TestTransaction>([
        [
          'tx1',
          { txid: 'tx1', vin: [{ txid: 'tx2', vout: 0 }], vout: [], depthH: 0 }
        ],
        [
          'tx2',
          { txid: 'tx2', vin: [{ txid: 'tx1', vout: 0 }], vout: [], depthH: 0 }
        ]
      ])

      const result = recalculateDepthH(transactions)
      // Both transactions should have valid depthH values
      expect(result.get('tx1')?.depthH).toBeGreaterThan(0)
      expect(result.get('tx2')?.depthH).toBeGreaterThan(0)
    })

    it('should set max depthH for transactions directly connected to selected inputs', () => {
      const transactions = new Map<string, TestTransaction>([
        [
          'tx1',
          {
            txid: 'tx1',
            vin: [],
            vout: [{ value: 100000, scriptpubkey_address: 'addr1' }],
            depthH: 0
          }
        ],
        [
          'tx2',
          {
            txid: 'tx2',
            vin: [{ txid: 'other', vout: 0 }],
            vout: [{ value: 200000, scriptpubkey_address: 'addr2' }],
            depthH: 0
          }
        ]
      ])

      const selectedInputs = new Map([
        ['input1', { value: 100000, scriptpubkey_address: 'addr1' }]
      ])

      const result = recalculateDepthH(transactions, selectedInputs)
      expect(result.get('tx1')?.depthH).toBe(1) // Max depthH since it's connected to selected input
      expect(result.get('tx2')?.depthH).toBe(1) // Regular depthH since it's not connected
    })

    it('should handle transactions with missing vout gracefully', () => {
      const transactions = new Map<string, TestTransaction>([
        ['tx1', { txid: 'tx1', vin: [], depthH: 0 }]
      ])

      const selectedInputs = new Map([
        ['input1', { value: 100000, scriptpubkey_address: 'addr1' }]
      ])

      const result = recalculateDepthH(transactions, selectedInputs)
      expect(result.get('tx1')?.depthH).toBe(1)
    })
  })
})
