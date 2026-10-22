import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import {
  buildBalanceHistory,
  buildChartData,
  buildFiatChartSeries,
  buildFiatStepPath,
  buildWalletAddresses,
  computeValidChartData,
  fiatDomainMax,
  fiatYDomain,
  hexToRgba,
  historyChartMargin,
  maxFiatChartValue,
  projectFiatOntoChart
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

describe('buildFiatChartSeries', () => {
  const now = new Date('2026-01-10T00:00:00Z')
  const bundled = () => 50_000

  it('converts the running balance with the price saved on the transaction', () => {
    const series = buildFiatChartSeries(
      [
        makeTx({
          id: 'a',
          prices: { USD: 40_000 },
          received: 100_000_000,
          timestamp: new Date('2026-01-02T00:00:00Z'),
          type: 'receive'
        })
      ],
      'USD',
      now,
      bundled
    )
    expect(series[0].value).toBe(40_000)
  })

  it('uses the bundled price when the transaction has no saved price', () => {
    const series = buildFiatChartSeries(
      [
        makeTx({
          id: 'a',
          received: 50_000_000,
          timestamp: new Date('2026-01-02T00:00:00Z'),
          type: 'receive'
        })
      ],
      'USD',
      now,
      () => 60_000
    )
    expect(series[0].value).toBe(30_000)
  })

  it('leaves a gap when neither the transaction nor the bundle has a price', () => {
    const series = buildFiatChartSeries(
      [
        makeTx({
          id: 'a',
          prices: { USD: 40_000 },
          received: 100_000_000,
          timestamp: new Date('2026-01-02T00:00:00Z'),
          type: 'receive'
        }),
        makeTx({
          id: 'b',
          received: 100_000_000,
          timestamp: new Date('2026-06-02T00:00:00Z'),
          type: 'receive'
        })
      ],
      'USD',
      now,
      () => null
    )
    expect(series.map((point) => point.value)).toStrictEqual([40_000, null])
    expect(maxFiatChartValue(series)).toBe(40_000)
  })

  it('does not use the bundled price when a saved price exists', () => {
    const series = buildFiatChartSeries(
      [
        makeTx({
          id: 'a',
          prices: { USD: 10_000 },
          received: 100_000_000,
          type: 'receive'
        })
      ],
      'USD',
      now,
      () => 99_000
    )
    expect(series[0].value).toBe(10_000)
  })
})

describe('projectFiatOntoChart', () => {
  it('carries the last priced balance across window edges and keeps gaps', () => {
    const now = new Date('2026-01-10T00:00:00Z')
    const transactions = [
      makeTx({
        id: 'a',
        received: 1,
        timestamp: new Date('2026-01-01T00:00:00Z'),
        type: 'receive'
      }),
      makeTx({
        id: 'b',
        received: 1,
        timestamp: new Date('2026-01-04T00:00:00Z'),
        type: 'receive'
      })
    ]
    const chartData = buildChartData(transactions, now)
    const fiatSeries = buildFiatChartSeries(
      transactions,
      'USD',
      now,
      () => null
    )
    fiatSeries[0].value = 10
    fiatSeries[1].value = null
    const [, valid] = computeValidChartData(
      chartData,
      new Date('2026-01-03T00:00:00Z'),
      new Date('2026-01-06T00:00:00Z'),
      now,
      true
    )
    const projected = projectFiatOntoChart(chartData, fiatSeries, valid)
    expect(projected.map((point) => point.value)).toStrictEqual([
      10,
      null,
      null
    ])
  })
})

describe('fiatDomainMax', () => {
  it('uses the full series when the y axis can pan', () => {
    expect(fiatDomainMax(false, 80, 20)).toBe(80)
  })

  it('uses the visible window when zoom is locked to the x axis', () => {
    expect(fiatDomainMax(true, 80, 20)).toBe(20)
  })
})

describe('fiatYDomain', () => {
  it('starts at zero when zoom is locked to the x axis', () => {
    expect(fiatYDomain(100, 200, 2, 40, true)).toStrictEqual([0, 120])
  })

  it('shifts with the sats pan and shares the pinch scale', () => {
    expect(fiatYDomain(100, 200, 2, 40, false)).toStrictEqual([20, 80])
  })
})

describe('buildFiatStepPath', () => {
  it('breaks the step line where a point has no fiat value', () => {
    const path = buildFiatStepPath(
      [
        { date: new Date('2026-01-01T00:00:00Z'), value: 10 },
        { date: new Date('2026-01-02T00:00:00Z'), value: null },
        { date: new Date('2026-01-03T00:00:00Z'), value: 30 }
      ],
      () => 0,
      (value) => value
    )
    expect(path?.match(/M/g)?.length).toBe(2)
  })

  it('returns null when every point is a gap', () => {
    expect(
      buildFiatStepPath(
        [{ date: new Date('2026-01-01T00:00:00Z'), value: null }],
        () => 0,
        (value) => value
      )
    ).toBeNull()
  })
})

describe('historyChartMargin', () => {
  it('reserves the right edge only while the fiat axis is shown', () => {
    expect(historyChartMargin(false).right).toBe(10)
    expect(historyChartMargin(true).right).toBe(52)
  })
})
