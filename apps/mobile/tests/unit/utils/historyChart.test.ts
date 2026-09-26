import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import {
  buildBalanceHistory,
  buildChartData,
  buildWalletAddresses,
  computeValidChartData,
  hexToRgba
} from '@/utils/historyChart'

function makeTx(
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>
): Transaction {
  return {
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    type: 'receive',
    vin: [],
    vout: [],
    ...overrides
  }
}

const utxo = (
  address: string,
  value: number,
  txid: string,
  vout: number
): Utxo => ({
  addressTo: address,
  keychain: 'external',
  label: '',
  txid,
  value,
  vout
})

describe('hexToRgba', () => {
  it('converts hex to rgba with opacity', () => {
    expect(hexToRgba('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
  })
})

describe('buildChartData', () => {
  it('accumulates a running balance across transactions', () => {
    const now = new Date('2026-01-10T00:00:00Z')
    const data = buildChartData(
      [
        makeTx({ id: 'a', received: 1000, type: 'receive' }),
        makeTx({ id: 'b', received: 200, sent: 500, type: 'send' })
      ],
      now
    )
    expect(data.map((d) => d.balance)).toStrictEqual([1000, 700])
    expect(data[1].amount).toBe(-300)
  })
})

describe('buildWalletAddresses', () => {
  it('collects utxo addresses and drops empty strings', () => {
    const addresses = buildWalletAddresses(
      [makeTx({ id: 'a' })],
      [utxo('tb1qa', 1000, 'a', 0), utxo('', 0, 'x', 0)]
    )
    expect(addresses.has('tb1qa')).toBe(true)
    expect(addresses.has('')).toBe(false)
  })
})

describe('buildBalanceHistory', () => {
  it('adds outputs on receive and removes spent inputs on send', () => {
    const addresses = new Set(['tb1qa'])
    const txs = [
      makeTx({
        id: 'a',
        received: 1000,
        type: 'receive',
        vout: [{ address: 'tb1qa', script: '', value: 1000 }]
      }),
      makeTx({
        id: 'b',
        sent: 1000,
        type: 'send',
        vin: [
          {
            previousOutput: { txid: 'a', vout: 0 },
            scriptSig: '',
            sequence: 0,
            witness: []
          }
        ]
      })
    ]
    const history = buildBalanceHistory(txs, addresses)
    expect(history.get(0)!.size).toBe(1)
    expect(history.get(0)!.has('a::0')).toBe(true)
    expect(history.get(1)!.size).toBe(0)
  })
})

describe('computeValidChartData', () => {
  it('clamps to the window and pads start/end sentinels', () => {
    const chartData = buildChartData(
      [
        makeTx({
          id: 'a',
          received: 1000,
          timestamp: new Date('2026-01-02T00:00:00Z'),
          type: 'receive'
        }),
        makeTx({
          id: 'b',
          received: 500,
          timestamp: new Date('2026-01-05T00:00:00Z'),
          type: 'receive'
        })
      ],
      new Date('2026-01-10T00:00:00Z')
    )
    const start = new Date('2026-01-03T00:00:00Z')
    const end = new Date('2026-01-06T00:00:00Z')
    const [maxBalance, valid] = computeValidChartData(
      chartData,
      start,
      end,
      new Date('2026-01-10T00:00:00Z'),
      true
    )
    // tx 'a' is before window -> becomes the start balance sentinel
    expect(valid[0].type).toBe('end')
    expect(valid[0].balance).toBe(1000)
    expect(valid.at(-1)!.type).toBe('end')
    expect(maxBalance).toBe(1500)
  })
})
