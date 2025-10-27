import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'

import type { ExtendedTransaction } from '../../../hooks/useInputTransactions.ts'
import {
  estimateTransactionSize,
  estimateTransactionSize2,
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

  describe('estimateTransactionSize2', () => {
    it('should correctly estimate transaction size for legacy inputs and outputs', () => {
      const utxo1: Utxo = {
        addressTo: 'mkyFyB2kkY8JwsnRLMLRG8Q2Ppn5BUeYoP',
        keychain: 'external',
        txid: 'tx-test-1',
        value: 1,
        vout: 0
      }
      const utxo2: Utxo = {
        addressTo: 'mqASYhnjpyAXaV1s2w2L73dhWCbfvgLfDz',
        keychain: 'external',
        txid: 'tx-test-2',
        value: 1,
        vout: 0
      }

      const output1: Output = {
        to: 'msu3M5xpDRrR43NC4E4FHoSd2fDhacXUXb',
        amount: 1,
        label: '',
        localId: ''
      }

      const resultWithChange = estimateTransactionSize2(
        [utxo1, utxo2],
        [output1],
        true
      )
      expect(resultWithChange.size).toBe(372)
      expect(resultWithChange.vsize).toBe(372)

      const resultWithoutChange = estimateTransactionSize2(
        [utxo1, utxo2],
        [output1]
      )
      expect(resultWithoutChange.size).toBe(338)
      expect(resultWithoutChange.vsize).toBe(338)
    })

    it('should correctly estimate transaction size for segwit inputs and legacy outputs', () => {
      const utxo1: Utxo = {
        addressTo: 'tb1q7aynfngxqxkcumxvptz0h3vydves9f5z7sqafl',
        keychain: 'external',
        txid: 'tx-test-1',
        value: 1,
        vout: 0
      }
      const utxo2: Utxo = {
        addressTo: 'tb1q0w063da99taqcgutc9g9x24vw4wjd7m2yxexq5',
        keychain: 'external',
        txid: 'tx-test-2',
        value: 1,
        vout: 0
      }

      const output1: Output = {
        to: 'n1tykAD25bXrw2jo3bY8J4Erk3V6MfhG47',
        amount: 1,
        label: '',
        localId: ''
      }

      const resultWithChange = estimateTransactionSize2(
        [utxo1, utxo2],
        [output1],
        true
      )
      expect(resultWithChange.size).toBe(373)
      expect(resultWithChange.vsize).toBe(211)

      const resultWithoutChange = estimateTransactionSize2(
        [utxo1, utxo2],
        [output1]
      )
      expect(resultWithoutChange.size).toBe(342)
      expect(resultWithoutChange.vsize).toBe(180)
    })

    it('should correctly estimate transaction size for segwit inputs and outputs', () => {
      const utxo1: Utxo = {
        addressTo: 'tb1q7aynfngxqxkcumxvptz0h3vydves9f5z7sqafl',
        keychain: 'external',
        txid: 'tx-test-1',
        value: 1,
        vout: 0
      }
      const utxo2: Utxo = {
        addressTo: 'tb1q0w063da99taqcgutc9g9x24vw4wjd7m2yxexq5',
        keychain: 'external',
        txid: 'tx-test-2',
        value: 1,
        vout: 0
      }

      const output1: Output = {
        to: 'tb1qygc2n34zkdnxks4j7k9ayv78l9rf7zjhta4pvk',
        amount: 1,
        label: '',
        localId: ''
      }

      const resultWithChange = estimateTransactionSize2(
        [utxo1, utxo2],
        [output1],
        true
      )
      expect(resultWithChange.size).toBe(370)
      expect(resultWithChange.vsize).toBe(208)

      const resultWithoutChange = estimateTransactionSize2(
        [utxo1, utxo2],
        [output1]
      )
      expect(resultWithoutChange.size).toBe(339)
      expect(resultWithoutChange.vsize).toBe(177)
    })

    it('should correctly estimate transaction size for segwit inputs and taproot outputs', () => {
      const utxo1: Utxo = {
        addressTo: 'tb1qmlqe87k5dkq6x6repu03zkk7u2hlhckrvqz6nv',
        keychain: 'external',
        txid: 'tx-test-1',
        value: 1,
        vout: 0
      }
      const utxo2: Utxo = {
        addressTo: 'tb1qrvvutzlpyv5qmtnl8ljwxhywth3r5s0cf9st0h',
        keychain: 'external',
        txid: 'tx-test-2',
        value: 1,
        vout: 0
      }

      const output1: Output = {
        to: 'tb1pqtrwjvqh0k759mwfpwcsz47rw6j3tqk5tjf2a9vy5ymv263fndyqe5fkrj',
        amount: 1,
        label: '',
        localId: ''
      }

      const resultWithChange = estimateTransactionSize2(
        [utxo1, utxo2],
        [output1],
        true
      )
      expect(resultWithChange.size).toBe(382)
      expect(resultWithChange.vsize).toBe(220)

      const resultWithoutChange = estimateTransactionSize2(
        [utxo1, utxo2],
        [output1]
      )
      expect(resultWithoutChange.size).toBe(351)
      expect(resultWithoutChange.vsize).toBe(189)
    })

    it('should correctly estimate transaction size for taproot inputs and outputs', () => {
      const utxo1: Utxo = {
        addressTo:
          'tb1pqtrwjvqh0k759mwfpwcsz47rw6j3tqk5tjf2a9vy5ymv263fndyqe5fkrj',
        keychain: 'external',
        txid: 'tx-test-1',
        value: 1,
        vout: 0
      }

      const output1: Output = {
        to: 'tb1pamrzdpunsyqegkgx8hqg9qzcueucqhen248wmfzrl90njnq35y7qdh55pf',
        amount: 1,
        label: '',
        localId: ''
      }

      const resultWithChange = estimateTransactionSize2(
        [utxo1],
        [output1],
        true
      )
      expect(resultWithChange.size).toBe(205)
      expect(resultWithChange.vsize).toBe(154)

      const resultWithoutChange = estimateTransactionSize2([utxo1], [output1])
      expect(resultWithoutChange.size).toBe(162)
      expect(resultWithoutChange.vsize).toBe(111)
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
