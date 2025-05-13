import type { ExtendedTransaction } from '../../../hooks/useInputTransactions.tsx'
import {
  estimateTransactionSize,
  recalculateDepthH
} from '../../../utils/transaction'

const minimalTxProps = {
  type: 'send' as const,
  sent: 0,
  received: 0,
  timestamp: new Date(),
  fee: 0,
  size: 0,
  vsize: 0,
  weight: 0,
  version: 1,
  lockTime: 0,
  lockTimeEnabled: false,
  raw: undefined,
  address: undefined,
  label: undefined,
  blockHeight: undefined,
  prices: {}
}

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

describe('recalculateDepthH', () => {
  it('should assign depthH = 1 to transactions with no dependencies within the set', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      [
        'txA',
        {
          ...minimalTxProps,
          id: 'txA',
          vin: [] as any,
          vout: [] as any,
          depthH: 0
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          id: 'txB',
          vin: [] as any,
          vout: [] as any,
          depthH: 0
        }
      ]
    ])
    const result = recalculateDepthH(transactions)
    expect(result.get('txA')?.depthH).toBe(1)
    expect(result.get('txB')?.depthH).toBe(1)
  })

  it('should correctly calculate depthH for a simple dependency chain (A -> B)', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      [
        'txA',
        {
          ...minimalTxProps,
          id: 'txA',
          vin: [] as any,
          vout: [] as any,
          depthH: 0
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          id: 'txB',
          vin: [{ previousOutput: { txid: 'txA', vout: 0 } }] as any,
          vout: [] as any,
          depthH: 0
        }
      ]
    ])
    const result = recalculateDepthH(transactions)
    expect(result.get('txA')?.depthH).toBe(1)
    expect(result.get('txB')?.depthH).toBe(3)
  })

  it('should correctly calculate depthH for a longer dependency chain (A -> B -> C)', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      [
        'txA',
        {
          ...minimalTxProps,
          id: 'txA',
          vin: [] as any,
          vout: [] as any,
          depthH: 0
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          id: 'txB',
          vin: [{ previousOutput: { txid: 'txA', vout: 0 } }] as any,
          vout: [] as any,
          depthH: 0
        }
      ],
      [
        'txC',
        {
          ...minimalTxProps,
          id: 'txC',
          vin: [{ previousOutput: { txid: 'txB', vout: 0 } }] as any,
          vout: [] as any,
          depthH: 0
        }
      ]
    ])
    const result = recalculateDepthH(transactions)
    expect(result.get('txA')?.depthH).toBe(1)
    expect(result.get('txB')?.depthH).toBe(3)
    expect(result.get('txC')?.depthH).toBe(5)
  })

  it('should handle transactions with multiple dependencies, taking max depthH + 2', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      [
        'txA',
        {
          ...minimalTxProps,
          id: 'txA',
          vin: [] as any,
          vout: [] as any,
          depthH: 0
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          id: 'txB',
          vin: [{ previousOutput: { txid: 'txA', vout: 0 } }] as any,
          vout: [] as any,
          depthH: 0
        }
      ],
      [
        'txC',
        {
          ...minimalTxProps,
          id: 'txC',
          vin: [] as any,
          vout: [] as any,
          depthH: 0
        }
      ],
      [
        'txD',
        {
          ...minimalTxProps,
          id: 'txD',
          vin: [
            { previousOutput: { txid: 'txB', vout: 0 } },
            { previousOutput: { txid: 'txC', vout: 0 } }
          ] as any,
          vout: [] as any,
          depthH: 0
        }
      ]
    ])
    const result = recalculateDepthH(transactions)
    expect(result.get('txA')?.depthH).toBe(1)
    expect(result.get('txB')?.depthH).toBe(3)
    expect(result.get('txC')?.depthH).toBe(1)
    expect(result.get('txD')?.depthH).toBe(5)
  })

  it('should ignore dependencies not present in the input transaction map', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      [
        'txA',
        {
          ...minimalTxProps,
          id: 'txA',
          vin: [{ previousOutput: { txid: 'txExternal', vout: 0 } }] as any,
          vout: [] as any,
          depthH: 0
        }
      ]
    ])
    const result = recalculateDepthH(transactions)
    expect(result.get('txA')?.depthH).toBe(1)
  })

  it('should handle circular dependencies gracefully (A -> B, B -> A)', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      [
        'txA',
        {
          ...minimalTxProps,
          id: 'txA',
          vin: [{ previousOutput: { txid: 'txB', vout: 0 } }] as any,
          vout: [] as any,
          depthH: 0
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          id: 'txB',
          vin: [{ previousOutput: { txid: 'txA', vout: 0 } }] as any,
          vout: [] as any,
          depthH: 0
        }
      ]
    ])
    let result: Map<string, ExtendedTransaction> | undefined
    expect(() => {
      result = recalculateDepthH(transactions)
    }).not.toThrow()
    expect(result?.get('txA')?.depthH).toBeDefined()
    expect(result?.get('txB')?.depthH).toBeDefined()
    expect(typeof result?.get('txA')?.depthH).toBe('number')
    expect(typeof result?.get('txB')?.depthH).toBe('number')
  })

  describe('with selectedInputs', () => {
    it('should set depthH to maxCalculatedDepthH for a no-dependency tx if its output is in selectedInputs and its not an input to others', () => {
      const transactions = new Map<string, ExtendedTransaction>([
        [
          'txA',
          {
            ...minimalTxProps,
            id: 'txA',
            vin: [] as any,
            vout: [{ value: 1000, address: 'addrA' }] as any,
            depthH: 0
          }
        ],
        [
          'txB',
          {
            ...minimalTxProps,
            id: 'txB',
            vin: [{ previousOutput: { txid: 'txExternal', vout: 0 } }] as any,
            vout: [{ value: 2000, address: 'addrB' }] as any,
            depthH: 0
          }
        ]
      ])
      const selectedInputs = new Map<
        string,
        { value: number; scriptpubkey_address: string }
      >([['input1', { value: 1000, scriptpubkey_address: 'addrA' }]])
      const result = recalculateDepthH(transactions, selectedInputs)
      expect(result.get('txA')?.depthH).toBe(1)
      expect(result.get('txB')?.depthH).toBe(1)
    })

    it('should set depthH to 1 for a no-dependency tx if output not in selectedInputs', () => {
      const transactions = new Map<string, ExtendedTransaction>([
        [
          'txA',
          {
            ...minimalTxProps,
            id: 'txA',
            vin: [] as any,
            vout: [{ value: 1000, address: 'addrA_NotInSelected' }] as any,
            depthH: 0
          }
        ]
      ])
      const selectedInputs = new Map<
        string,
        { value: number; scriptpubkey_address: string }
      >([['input1', { value: 500, scriptpubkey_address: 'addrOther' }]])
      const result = recalculateDepthH(transactions, selectedInputs)
      expect(result.get('txA')?.depthH).toBe(1)
    })

    it('should set depthH to 1 for a no-dependency tx if it IS an input to another tx in the set, even if output in selectedInputs', () => {
      const transactions = new Map<string, ExtendedTransaction>([
        [
          'txA',
          {
            ...minimalTxProps,
            id: 'txA',
            vin: [] as any,
            vout: [{ value: 1000, address: 'addrA' }] as any,
            depthH: 0
          }
        ],
        [
          'txB',
          {
            ...minimalTxProps,
            id: 'txB',
            vin: [{ previousOutput: { txid: 'txA', vout: 0 } }] as any,
            vout: [] as any,
            depthH: 0
          }
        ]
      ])
      const selectedInputs = new Map<
        string,
        { value: number; scriptpubkey_address: string }
      >([['input1', { value: 1000, scriptpubkey_address: 'addrA' }]])
      const result = recalculateDepthH(transactions, selectedInputs)
      expect(result.get('txA')?.depthH).toBe(1)
      expect(result.get('txB')?.depthH).toBe(3)
    })

    it('should correctly adjust depthH for no-dependency tx connected to selectedInput when other txs establish a higher maxCalculatedDepthH', () => {
      const transactions = new Map<string, ExtendedTransaction>([
        [
          'txA',
          {
            ...minimalTxProps,
            id: 'txA',
            vin: [] as any,
            vout: [{ value: 1000, address: 'addrA' }] as any,
            depthH: 0
          }
        ],
        [
          'txB',
          {
            ...minimalTxProps,
            id: 'txB',
            vin: [] as any,
            vout: [] as any,
            depthH: 0
          }
        ],
        [
          'txC',
          {
            ...minimalTxProps,
            id: 'txC',
            vin: [{ previousOutput: { txid: 'txB', vout: 0 } }] as any,
            vout: [] as any,
            depthH: 0
          }
        ]
      ])
      const selectedInputs = new Map<
        string,
        { value: number; scriptpubkey_address: string }
      >([['input1', { value: 1000, scriptpubkey_address: 'addrA' }]])
      const result = recalculateDepthH(transactions, selectedInputs)
      expect(result.get('txA')?.depthH).toBe(3)
      expect(result.get('txB')?.depthH).toBe(1)
      expect(result.get('txC')?.depthH).toBe(3)
    })
  })

  it('should handle an empty transaction map', () => {
    const transactions = new Map<string, ExtendedTransaction>()
    const result = recalculateDepthH(transactions)
    expect(result.size).toBe(0)
  })

  it('should handle transactions with inputs that are not in the map (external dependencies)', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      [
        'txA',
        {
          ...minimalTxProps,
          id: 'txA',
          vin: [{ previousOutput: { txid: 'txExternal1', vout: 0 } }] as any,
          vout: [] as any,
          depthH: 0
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          id: 'txB',
          vin: [
            { previousOutput: { txid: 'txA', vout: 0 } },
            { previousOutput: { txid: 'txExternal2', vout: 0 } }
          ] as any,
          vout: [] as any,
          depthH: 0
        }
      ]
    ])
    const result = recalculateDepthH(transactions)
    expect(result.get('txA')?.depthH).toBe(1)
    expect(result.get('txB')?.depthH).toBe(3)
  })

  it('should correctly set maxCalculatedDepthH even with only one transaction', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      [
        'txA',
        {
          ...minimalTxProps,
          id: 'txA',
          vin: [] as any,
          vout: [] as any,
          depthH: 0
        }
      ]
    ])
    const result = recalculateDepthH(transactions)
    expect(result.get('txA')?.depthH).toBe(1)
  })
})
