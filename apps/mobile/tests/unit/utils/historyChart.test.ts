import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import {
  buildBalanceHistory,
  buildChartData,
  buildFiatChartPoints,
  buildFiatStepPath,
  buildFiatValueById,
  buildTransactionsMap,
  buildWalletAddresses,
  computeValidChartData,
  fiatDomainMax,
  fiatYDomain,
  hexToRgba,
  historyChartMargin,
  maxFiatValue,
  satsYDomain
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

describe('buildFiatValueById', () => {
  const now = new Date('2026-01-10T00:00:00Z')

  function fiatValues(
    transactions: Transaction[],
    bundledPriceAt: (timestamp: number) => number | null
  ) {
    return buildFiatValueById({
      bundledPriceAt,
      chartData: buildChartData(transactions, now),
      currency: 'USD',
      transactionsMap: buildTransactionsMap(transactions)
    })
  }

  it('converts the running balance with the price saved on the transaction', () => {
    const values = fiatValues(
      [
        makeTx({
          id: 'a',
          prices: { USD: 40_000 },
          received: 100_000_000,
          timestamp: new Date('2026-01-02T00:00:00Z'),
          type: 'receive'
        })
      ],
      () => 50_000
    )
    expect(values.get('a')).toBe(40_000)
  })

  it('uses the bundled price when the transaction has no saved price', () => {
    const values = fiatValues(
      [
        makeTx({
          id: 'a',
          received: 50_000_000,
          timestamp: new Date('2026-01-02T00:00:00Z'),
          type: 'receive'
        })
      ],
      () => 60_000
    )
    expect(values.get('a')).toBe(30_000)
  })

  it('looks up the bundled price for a persisted string timestamp', () => {
    const bundledPriceAt = jest.fn(() => 60_000)
    const persisted = {
      ...makeTx({ id: 'a', received: 50_000_000, type: 'receive' }),
      timestamp: '2026-01-02T00:00:00.000Z'
    }
    const values = buildFiatValueById({
      bundledPriceAt,
      chartData: [
        {
          amount: 50_000_000,
          balance: 50_000_000,
          date: new Date('2026-01-02T00:00:00Z'),
          id: 'a',
          memo: '',
          type: 'receive'
        }
      ],
      currency: 'USD',
      transactionsMap: new Map([['a', persisted]])
    })
    expect(bundledPriceAt).toHaveBeenCalledWith(1_767_312_000)
    expect(values.get('a')).toBe(30_000)
  })

  it('leaves a gap when neither the transaction nor the bundle has a price', () => {
    const values = fiatValues(
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
      () => null
    )
    expect(values.get('a')).toBe(40_000)
    expect(values.has('b')).toBe(false)
    expect(maxFiatValue(values.values())).toBe(40_000)
  })

  it('does not use the bundled price when a saved price exists', () => {
    const values = fiatValues(
      [
        makeTx({
          id: 'a',
          prices: { USD: 10_000 },
          received: 100_000_000,
          type: 'receive'
        })
      ],
      () => 99_000
    )
    expect(values.get('a')).toBe(10_000)
  })

  it('values the balance left after a send', () => {
    const values = fiatValues(
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
          prices: { USD: 50_000 },
          received: 10_000_000,
          sent: 60_000_000,
          timestamp: new Date('2026-01-03T00:00:00Z'),
          type: 'send'
        })
      ],
      () => null
    )
    expect(values.get('b')).toBe(25_000)
  })

  it('leaves an unconfirmed transaction without a saved price unpriced', () => {
    const bundledPriceAt = jest.fn(() => 60_000)
    const values = fiatValues(
      [makeTx({ id: 'a', received: 100_000_000, type: 'receive' })],
      bundledPriceAt
    )
    expect(values.has('a')).toBe(false)
    expect(bundledPriceAt).not.toHaveBeenCalled()
  })
})

describe('buildFiatChartPoints', () => {
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

  function pointValues(
    fiatValueById: Map<string, number>,
    startDate: Date,
    endDate: Date
  ) {
    const [, validChartData] = computeValidChartData(
      chartData,
      startDate,
      endDate,
      now,
      true
    )
    return buildFiatChartPoints({
      chartData,
      fiatValueById,
      startDate,
      validChartData
    }).map((point) => point.value)
  }

  it('carries the last priced balance across window edges and keeps gaps', () => {
    expect(
      pointValues(
        new Map([['a', 10]]),
        new Date('2026-01-03T00:00:00Z'),
        new Date('2026-01-06T00:00:00Z')
      )
    ).toStrictEqual([10, null, null])
  })

  it('carries the value before the window to both edges of an empty window', () => {
    expect(
      pointValues(
        new Map([
          ['a', 10],
          ['b', 20]
        ]),
        new Date('2026-01-05T00:00:00Z'),
        new Date('2026-01-06T00:00:00Z')
      )
    ).toStrictEqual([20, 20])
  })

  it('starts with a gap when the window opens before the first transaction', () => {
    expect(
      pointValues(
        new Map([['a', 10]]),
        new Date('2025-12-30T00:00:00Z'),
        new Date('2026-01-02T00:00:00Z')
      )
    ).toStrictEqual([null, 10, 10])
  })
})

describe('maxFiatValue', () => {
  it('ignores gaps and never drops below zero', () => {
    expect(maxFiatValue([null, 5, 12, null])).toBe(12)
    expect(maxFiatValue([])).toBe(0)
  })
})

describe('fiatDomainMax', () => {
  const fiatChartPoints = [
    { date: new Date('2026-01-01T00:00:00Z'), value: 20 },
    { date: new Date('2026-01-02T00:00:00Z'), value: null }
  ]

  it('uses the full series when the y axis can pan', () => {
    expect(
      fiatDomainMax({ fiatChartPoints, lockZoomToXAxis: false, seriesMax: 80 })
    ).toBe(80)
  })

  it('uses the visible window when zoom is locked to the x axis', () => {
    expect(
      fiatDomainMax({ fiatChartPoints, lockZoomToXAxis: true, seriesMax: 80 })
    ).toBe(20)
  })
})

describe('satsYDomain', () => {
  it('starts at zero with headroom when zoom is locked to the x axis', () => {
    expect(
      satsYDomain({
        lockZoomToXAxis: true,
        maxBalance: 200,
        scale: 2,
        startY: 40
      })
    ).toStrictEqual([0, 240])
  })

  it('follows the pan offset and pinch scale', () => {
    expect(
      satsYDomain({
        lockZoomToXAxis: false,
        maxBalance: 200,
        scale: 2,
        startY: 40
      })
    ).toStrictEqual([40, 160])
  })
})

describe('fiatYDomain', () => {
  it('starts at zero when zoom is locked to the x axis', () => {
    expect(
      fiatYDomain({
        lockZoomToXAxis: true,
        maxBalance: 200,
        maxFiat: 100,
        scale: 2,
        startY: 40
      })
    ).toStrictEqual([0, 120])
  })

  it('shifts with the sats pan and shares the pinch scale', () => {
    expect(
      fiatYDomain({
        lockZoomToXAxis: false,
        maxBalance: 200,
        maxFiat: 100,
        scale: 2,
        startY: 40
      })
    ).toStrictEqual([20, 80])
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
