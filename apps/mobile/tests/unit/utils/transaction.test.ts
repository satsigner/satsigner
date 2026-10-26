import * as bitcoinjs from 'bitcoinjs-lib'

import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'

import type { ExtendedTransaction } from '../../../hooks/useInputTransactions.ts'
import {
  assignOutputDepthOrder,
  buildChartTransactionFromBuilder,
  buildPreviewTransactionHex,
  estimateBuilderTransactionSize,
  estimateTransactionSize,
  findFirstInvalidOutputAddress,
  getFinalizedTransactionSize,
  getPreviewTransactionHex,
  getRawTransactionSizes,
  getTransactionIdDisplay,
  legacyEstimateTransactionSize,
  mapBuildTransactionError,
  recalculateDepthH,
  weightToVsize
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

describe('assignOutputDepthOrder', () => {
  function buildTransaction(id: string, depthH: number, outputCount: number) {
    return {
      ...minimalTxProps,
      depthH,
      id,
      vin: [] as unknown as ExtendedTransaction['vin'],
      vout: Array.from({ length: outputCount }, (_, index) => ({
        address: `${id}-out-${index}`,
        value: 1000
      })) as unknown as ExtendedTransaction['vout']
    }
  }

  function getDepthOrders(
    transactions: Map<string, ExtendedTransaction>,
    txid: string
  ) {
    return transactions.get(txid)?.vout.map((output) => output.depthOrder)
  }

  it('numbers outputs across transactions sharing a depth', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      ['txA', buildTransaction('txA', 1, 2)],
      ['txB', buildTransaction('txB', 1, 1)]
    ])
    const result = assignOutputDepthOrder(transactions)
    expect(getDepthOrders(result, 'txA')).toStrictEqual([0, 1])
    expect(getDepthOrders(result, 'txB')).toStrictEqual([2])
  })

  it('restarts the numbering at each depth', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      ['txA', buildTransaction('txA', 1, 2)],
      ['txC', buildTransaction('txC', 3, 2)]
    ])
    const result = assignOutputDepthOrder(transactions)
    expect(getDepthOrders(result, 'txA')).toStrictEqual([0, 1])
    expect(getDepthOrders(result, 'txC')).toStrictEqual([0, 1])
  })

  it('keeps the rest of each output', () => {
    const transactions = new Map<string, ExtendedTransaction>([
      ['txA', buildTransaction('txA', 1, 1)]
    ])
    const [output] = assignOutputDepthOrder(transactions).get('txA')?.vout ?? []
    expect(output).toMatchObject({ address: 'txA-out-0', value: 1000 })
  })
})

describe('transaction builder previews', () => {
  const address = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
  const utxo: Utxo = {
    addressTo: address,
    keychain: 'external',
    label: 'coffee',
    txid: `${'aa'.repeat(31)}bb`,
    value: 100_000,
    vout: 1
  }
  const output: Output = {
    amount: 90_000,
    label: 'rent',
    localId: 'out-1',
    to: address
  }

  it('builds a hex whose inputs spend the builder txids', () => {
    const txHex = buildPreviewTransactionHex(
      new Map([['a', utxo]]),
      [output],
      'bitcoin'
    )
    const [input] = bitcoinjs.Transaction.fromHex(txHex).ins
    // eslint-disable-next-line unicorn/no-array-reverse -- Hermes lacks TypedArray#toReversed
    expect(Buffer.from(input.hash).reverse().toString('hex')).toBe(utxo.txid)
    expect(input.index).toBe(utxo.vout)
  })

  it('skips inputs with an invalid txid', () => {
    const txHex = buildPreviewTransactionHex(
      new Map([['a', { ...utxo, txid: 'not-a-txid' }]]),
      [output],
      'bitcoin'
    )
    expect(txHex).toBe(
      buildPreviewTransactionHex(new Map(), [output], 'bitcoin')
    )
  })

  it('returns empty hex when an output address is invalid', () => {
    expect(
      buildPreviewTransactionHex(
        new Map([['a', utxo]]),
        [{ ...output, to: 'invalid' }],
        'bitcoin'
      )
    ).toBe('')
  })

  it('returns empty hex when an output amount is not whole sats', () => {
    expect(
      buildPreviewTransactionHex(
        new Map([['a', utxo]]),
        [{ ...output, amount: 1.5 }],
        'bitcoin'
      )
    ).toBe('')
  })

  it('decodes the PSBT unsigned transaction when a PSBT exists', () => {
    const psbt = new bitcoinjs.Psbt()
    psbt.setVersion(2)
    psbt.setLocktime(327_618)
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      sequence: 0xff_ff_ff_fd
    })
    psbt.addOutput({ address, value: output.amount })

    const tx = bitcoinjs.Transaction.fromHex(
      getPreviewTransactionHex(
        psbt.toBase64(),
        new Map([['a', utxo]]),
        [output],
        'bitcoin'
      )
    )

    expect(tx.version).toBe(2)
    expect(tx.locktime).toBe(327_618)
    expect(tx.ins[0].sequence).toBe(0xff_ff_ff_fd)
  })

  it('rebuilds the preview from builder data without a PSBT', () => {
    expect(
      getPreviewTransactionHex(
        undefined,
        new Map([['a', utxo]]),
        [output],
        'bitcoin'
      )
    ).toBe(
      buildPreviewTransactionHex(new Map([['a', utxo]]), [output], 'bitcoin')
    )
  })

  it('builds the chart transaction from builder data', () => {
    const transaction = buildChartTransactionFromBuilder(
      new Map([['a', utxo]]),
      [output],
      'txid-1'
    )
    expect(transaction.id).toBe('txid-1')
    expect(transaction.vin).toHaveLength(1)
    expect(transaction.vin[0].previousOutput).toStrictEqual({
      txid: utxo.txid,
      vout: utxo.vout
    })
    expect(transaction.vout[0]).toMatchObject({
      address,
      label: 'rent',
      value: 90_000
    })
  })
})

describe('findFirstInvalidOutputAddress', () => {
  const validAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
  const output: Output = {
    amount: 1000,
    label: '',
    localId: 'out-1',
    to: validAddress
  }

  it('returns undefined when every address is valid', () => {
    expect(findFirstInvalidOutputAddress([output], 'bitcoin')).toBeUndefined()
  })

  it('returns the first invalid address for the network', () => {
    const testnetAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
    expect(
      findFirstInvalidOutputAddress(
        [output, { ...output, to: testnetAddress }],
        'bitcoin'
      )
    ).toBe(testnetAddress)
  })

  it('skips outputs whose script has no address', () => {
    expect(
      findFirstInvalidOutputAddress(
        [{ ...output, to: 'Unknown Address 1' }],
        'bitcoin'
      )
    ).toBeUndefined()
  })

  it('skips addresses still too short to validate', () => {
    expect(
      findFirstInvalidOutputAddress([{ ...output, to: 'bc1q' }], 'bitcoin')
    ).toBeUndefined()
  })
})

describe('estimateBuilderTransactionSize', () => {
  it('falls back to the legacy estimate without inputs', () => {
    expect(estimateBuilderTransactionSize(new Map(), [])).toStrictEqual(
      legacyEstimateTransactionSize(0, 0)
    )
  })
})

describe('getFinalizedTransactionSize', () => {
  it('returns null for empty, PSBT or invalid hex', () => {
    expect(getFinalizedTransactionSize('')).toBeNull()
    expect(
      getFinalizedTransactionSize(`70736274ff${'00'.repeat(20)}`)
    ).toBeNull()
    expect(getFinalizedTransactionSize('zz'.repeat(20))).toBeNull()
  })

  it('reads size and vsize of a raw transaction', () => {
    const transaction = new bitcoinjs.Transaction()
    transaction.addInput(Buffer.alloc(32), 0)
    transaction.addOutput(Buffer.from(`0014${'00'.repeat(20)}`, 'hex'), 1000)
    expect(getFinalizedTransactionSize(transaction.toHex())).toStrictEqual({
      size: transaction.byteLength(true),
      vsize: transaction.virtualSize()
    })
  })
})

describe('mapBuildTransactionError', () => {
  it('shows a dust message without a toast', () => {
    expect(
      mapBuildTransactionError(new Error('Output below the dust limit'))
    ).toStrictEqual({
      isDust: true,
      message: { key: 'transaction.error.previewBuildFailedDust' },
      notice: null
    })
  })

  it('asks to sync when a UTXO is missing', () => {
    const result = mapBuildTransactionError(new Error('UTXO not found: abc:0'))
    expect(result.message).toStrictEqual({ text: 'UTXO not found: abc:0' })
    expect(result.notice).toStrictEqual({
      key: 'transaction.preview.utxoNotFound',
      type: 'error'
    })
  })

  it('shows the library message for other errors', () => {
    expect(mapBuildTransactionError('Insufficient funds')).toStrictEqual({
      isDust: false,
      message: { text: 'Insufficient funds' },
      notice: { text: 'Insufficient funds', type: 'error' }
    })
  })
})

describe('getTransactionIdDisplay', () => {
  const ready = {
    isLoadingPSBT: false,
    psbtBuildStatus: 'idle',
    transactionId: 'ab'.repeat(32)
  } satisfies Parameters<typeof getTransactionIdDisplay>[0]

  it('shows the transaction id once built', () => {
    expect(getTransactionIdDisplay(ready)).toStrictEqual({
      text: 'ab'.repeat(32)
    })
  })

  it('shows progress while loading or building', () => {
    expect(
      getTransactionIdDisplay({ ...ready, isLoadingPSBT: true })
    ).toStrictEqual({ key: 'common.loading' })
    expect(
      getTransactionIdDisplay({ ...ready, psbtBuildStatus: 'building' })
    ).toStrictEqual({ key: 'transaction.preview.buildingTransaction' })
  })

  it('shows a placeholder after a failed build or without an id', () => {
    expect(
      getTransactionIdDisplay({ ...ready, psbtBuildStatus: 'error' })
    ).toStrictEqual({ text: '—' })
    expect(
      getTransactionIdDisplay({ ...ready, transactionId: '' })
    ).toStrictEqual({ text: '—' })
  })
})

describe('weightToVsize', () => {
  it('rounds weight units up to whole vbytes', () => {
    expect(weightToVsize(400)).toBe(100)
    expect(weightToVsize(401)).toBe(101)
  })
})

describe('getRawTransactionSizes', () => {
  const P2WPKH_OUTPUT = Buffer.concat([
    Buffer.from([0x00, 0x14]),
    Buffer.alloc(20, 2)
  ])

  function oneInOneOutTransaction() {
    const transaction = new bitcoinjs.Transaction()
    transaction.version = 2
    transaction.addInput(Buffer.alloc(32, 1), 0)
    transaction.addOutput(P2WPKH_OUTPUT, 1000)
    return transaction
  }

  it('applies the witness discount to a segwit transaction', () => {
    const transaction = oneInOneOutTransaction()
    transaction.setWitness(0, [Buffer.alloc(72, 3), Buffer.alloc(33, 4)])

    expect(getRawTransactionSizes(transaction.toHex())).toStrictEqual({
      size: 192,
      vsize: 110,
      weight: 438
    })
  })

  it('counts every byte four times for a legacy transaction', () => {
    expect(
      getRawTransactionSizes(oneInOneOutTransaction().toHex())
    ).toStrictEqual({ size: 82, vsize: 82, weight: 328 })
  })

  it('returns zero sizes without a raw transaction', () => {
    expect(getRawTransactionSizes('')).toStrictEqual({
      size: 0,
      vsize: 0,
      weight: 0
    })
  })
})
