import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'

import type { ExtendedTransaction } from '../../../hooks/useInputTransactions.ts'
import {
  estimateTransactionSize,
  recalculateDepthH
} from '../../../utils/transaction'

const minimalTxProps = {
  address: undefined,
  blockHeight: undefined,
  fee: 0,
  label: undefined,
  lockTime: 0,
  lockTimeEnabled: false,
  prices: {},
  raw: undefined,
  received: 0,
  sent: 0,
  size: 0,
  timestamp: new Date(),
  type: 'send' as const,
  version: 1,
  vsize: 0,
  weight: 0
}

describe('transaction Utils', () => {
  describe('estimateTransactionSize', () => {
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
        amount: 1,
        label: '',
        localId: '',
        to: 'msu3M5xpDRrR43NC4E4FHoSd2fDhacXUXb'
      }

      const resultWithChange = estimateTransactionSize(
        [utxo1, utxo2],
        [output1],
        true
      )
      expect(resultWithChange.size).toBe(372)
      expect(resultWithChange.vsize).toBe(372)

      const resultWithoutChange = estimateTransactionSize(
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
        amount: 1,
        label: '',
        localId: '',
        to: 'n1tykAD25bXrw2jo3bY8J4Erk3V6MfhG47'
      }

      const resultWithChange = estimateTransactionSize(
        [utxo1, utxo2],
        [output1],
        true
      )
      expect(resultWithChange.size).toBe(373)
      expect(resultWithChange.vsize).toBe(211)

      const resultWithoutChange = estimateTransactionSize(
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
        amount: 1,
        label: '',
        localId: '',
        to: 'tb1qygc2n34zkdnxks4j7k9ayv78l9rf7zjhta4pvk'
      }

      const resultWithChange = estimateTransactionSize(
        [utxo1, utxo2],
        [output1],
        true
      )
      expect(resultWithChange.size).toBe(370)
      expect(resultWithChange.vsize).toBe(208)

      const resultWithoutChange = estimateTransactionSize(
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
        amount: 1,
        label: '',
        localId: '',
        to: 'tb1pqtrwjvqh0k759mwfpwcsz47rw6j3tqk5tjf2a9vy5ymv263fndyqe5fkrj'
      }

      const resultWithChange = estimateTransactionSize(
        [utxo1, utxo2],
        [output1],
        true
      )
      expect(resultWithChange.size).toBe(382)
      expect(resultWithChange.vsize).toBe(220)

      const resultWithoutChange = estimateTransactionSize(
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
        amount: 1,
        label: '',
        localId: '',
        to: 'tb1pamrzdpunsyqegkgx8hqg9qzcueucqhen248wmfzrl90njnq35y7qdh55pf'
      }

      const resultWithChange = estimateTransactionSize([utxo1], [output1], true)
      expect(resultWithChange.size).toBe(205)
      expect(resultWithChange.vsize).toBe(154)

      const resultWithoutChange = estimateTransactionSize([utxo1], [output1])
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
          depthH: 0,
          id: 'txA',
          vin: [] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          depthH: 0,
          id: 'txB',
          vin: [] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
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
          depthH: 0,
          id: 'txA',
          vin: [] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          depthH: 0,
          id: 'txB',
          vin: [
            { previousOutput: { txid: 'txA', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
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
          depthH: 0,
          id: 'txA',
          vin: [] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          depthH: 0,
          id: 'txB',
          vin: [
            { previousOutput: { txid: 'txA', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ],
      [
        'txC',
        {
          ...minimalTxProps,
          depthH: 0,
          id: 'txC',
          vin: [
            { previousOutput: { txid: 'txB', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
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
          depthH: 0,
          id: 'txA',
          vin: [] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          depthH: 0,
          id: 'txB',
          vin: [
            { previousOutput: { txid: 'txA', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ],
      [
        'txC',
        {
          ...minimalTxProps,
          depthH: 0,
          id: 'txC',
          vin: [] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ],
      [
        'txD',
        {
          ...minimalTxProps,
          depthH: 0,
          id: 'txD',
          vin: [
            { previousOutput: { txid: 'txB', vout: 0 } },
            { previousOutput: { txid: 'txC', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
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
          depthH: 0,
          id: 'txA',
          vin: [
            { previousOutput: { txid: 'txExternal', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
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
          depthH: 0,
          id: 'txA',
          vin: [
            { previousOutput: { txid: 'txB', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          depthH: 0,
          id: 'txB',
          vin: [
            { previousOutput: { txid: 'txA', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
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
            depthH: 0,
            id: 'txA',
            vin: [] as unknown as ExtendedTransaction['vin'],
            vout: [
              { address: 'addrA', value: 1000 }
            ] as unknown as ExtendedTransaction['vout']
          }
        ],
        [
          'txB',
          {
            ...minimalTxProps,
            depthH: 0,
            id: 'txB',
            vin: [
              { previousOutput: { txid: 'txExternal', vout: 0 } }
            ] as unknown as ExtendedTransaction['vin'],
            vout: [
              { address: 'addrB', value: 2000 }
            ] as unknown as ExtendedTransaction['vout']
          }
        ]
      ])
      const selectedInputs = new Map<
        string,
        { value: number; scriptpubkey_address: string }
      >([['input1', { scriptpubkey_address: 'addrA', value: 1000 }]])
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
            depthH: 0,
            id: 'txA',
            vin: [] as unknown as ExtendedTransaction['vin'],
            vout: [
              { address: 'addrA_NotInSelected', value: 1000 }
            ] as unknown as ExtendedTransaction['vout']
          }
        ]
      ])
      const selectedInputs = new Map<
        string,
        { value: number; scriptpubkey_address: string }
      >([['input1', { scriptpubkey_address: 'addrOther', value: 500 }]])
      const result = recalculateDepthH(transactions, selectedInputs)
      expect(result.get('txA')?.depthH).toBe(1)
    })

    it('should set depthH to 1 for a no-dependency tx if it IS an input to another tx in the set, even if output in selectedInputs', () => {
      const transactions = new Map<string, ExtendedTransaction>([
        [
          'txA',
          {
            ...minimalTxProps,
            depthH: 0,
            id: 'txA',
            vin: [] as unknown as ExtendedTransaction['vin'],
            vout: [
              { address: 'addrA', value: 1000 }
            ] as unknown as ExtendedTransaction['vout']
          }
        ],
        [
          'txB',
          {
            ...minimalTxProps,
            depthH: 0,
            id: 'txB',
            vin: [
              { previousOutput: { txid: 'txA', vout: 0 } }
            ] as unknown as ExtendedTransaction['vin'],
            vout: [] as unknown as ExtendedTransaction['vout']
          }
        ]
      ])
      const selectedInputs = new Map<
        string,
        { value: number; scriptpubkey_address: string }
      >([['input1', { scriptpubkey_address: 'addrA', value: 1000 }]])
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
            depthH: 0,
            id: 'txA',
            vin: [] as unknown as ExtendedTransaction['vin'],
            vout: [
              { address: 'addrA', value: 1000 }
            ] as unknown as ExtendedTransaction['vout']
          }
        ],
        [
          'txB',
          {
            ...minimalTxProps,
            depthH: 0,
            id: 'txB',
            vin: [] as unknown as ExtendedTransaction['vin'],
            vout: [] as unknown as ExtendedTransaction['vout']
          }
        ],
        [
          'txC',
          {
            ...minimalTxProps,
            depthH: 0,
            id: 'txC',
            vin: [
              { previousOutput: { txid: 'txB', vout: 0 } }
            ] as unknown as ExtendedTransaction['vin'],
            vout: [] as unknown as ExtendedTransaction['vout']
          }
        ]
      ])
      const selectedInputs = new Map<
        string,
        { value: number; scriptpubkey_address: string }
      >([['input1', { scriptpubkey_address: 'addrA', value: 1000 }]])
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
          depthH: 0,
          id: 'txA',
          vin: [
            { previousOutput: { txid: 'txExternal1', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ],
      [
        'txB',
        {
          ...minimalTxProps,
          depthH: 0,
          id: 'txB',
          vin: [
            { previousOutput: { txid: 'txA', vout: 0 } },
            { previousOutput: { txid: 'txExternal2', vout: 0 } }
          ] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
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
          depthH: 0,
          id: 'txA',
          vin: [] as unknown as ExtendedTransaction['vin'],
          vout: [] as unknown as ExtendedTransaction['vout']
        }
      ]
    ])
    const result = recalculateDepthH(transactions)
    expect(result.get('txA')?.depthH).toBe(1)
  })
})
