import { Colors } from '@/styles'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import {
  buildBalanceHistory,
  buildChartData,
  buildFiatChartPoints,
  buildFiatLinePath,
  buildWalletAddresses,
  computeValidChartData,
  fiatDomainMax,
  fiatPointsInWindow,
  fiatSeriesColor,
  fiatYDomain,
  formatFiatAxisTick,
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

const DAY = 86_400

function unixDays(start: string, count: number) {
  const origin = new Date(start).getTime() / 1000
  return Array.from({ length: count }, (_, index) => origin + index * DAY)
}

describe('buildFiatChartPoints', () => {
  const now = new Date('2026-01-10T00:00:00Z')
  const start = new Date('2026-01-01T00:00:00Z')
  const end = new Date('2026-01-06T00:00:00Z')
  const defaultRange = { endDate: end, startDate: start }

  function pointsFor(
    transactions: Transaction[],
    prices: (number | null)[],
    range: { endDate: Date; startDate: Date }
  ) {
    const times = unixDays('2026-01-01T00:00:00Z', prices.length)
    return buildFiatChartPoints({
      chartData: buildChartData(transactions, now),
      closes: times.map((time, index) => ({ price: prices[index], time })),
      endDate: range.endDate,
      startDate: range.startDate
    }).map((point) => point.value)
  }

  it('follows each bundled close while the balance stays constant', () => {
    const values = pointsFor(
      [
        makeTx({
          id: 'a',
          prices: { USD: 10_000 },
          received: 100_000_000,
          timestamp: new Date('2026-01-01T00:00:00Z'),
          type: 'receive'
        })
      ],
      [40_000, 50_000, 60_000],
      defaultRange
    )
    expect(values).toStrictEqual([40_000, 50_000, 60_000])
  })

  it('keeps moving after a single transaction as later closes arrive', () => {
    const values = pointsFor(
      [
        makeTx({
          id: 'a',
          received: 50_000_000,
          timestamp: new Date('2026-01-01T00:00:00Z'),
          type: 'receive'
        })
      ],
      [40_000, 80_000, 20_000],
      {
        endDate: new Date('2026-01-03T00:00:00Z'),
        startDate: new Date('2026-01-01T00:00:00Z')
      }
    )
    expect(values).toStrictEqual([20_000, 40_000, 10_000])
  })

  it('marks the balance to the selected currency closes', () => {
    const transactions = [
      makeTx({
        id: 'a',
        received: 100_000_000,
        timestamp: new Date('2026-01-01T00:00:00Z'),
        type: 'receive'
      })
    ]
    const chartData = buildChartData(transactions, now)
    const times = unixDays('2026-01-01T00:00:00Z', 2)
    const bundles = {
      EUR: [40_000, 42_000],
      USD: [50_000, 55_000]
    }

    function series(currency: keyof typeof bundles) {
      return buildFiatChartPoints({
        chartData,
        closes: times.map((time, index) => ({
          price: bundles[currency][index],
          time
        })),
        endDate: new Date('2026-01-02T00:00:00Z'),
        startDate: start
      }).map((point) => point.value)
    }

    expect(series('USD')).toStrictEqual([50_000, 55_000])
    expect(series('EUR')).toStrictEqual([40_000, 42_000])
  })

  it('leaves a gap where a bundled timestamp has no close', () => {
    const values = pointsFor(
      [
        makeTx({
          id: 'a',
          received: 100_000_000,
          timestamp: new Date('2026-01-01T00:00:00Z'),
          type: 'receive'
        })
      ],
      [40_000, null, 60_000],
      defaultRange
    )
    expect(values).toStrictEqual([40_000, null, 60_000])
    expect(maxFiatValue(values)).toBe(60_000)
  })

  it('uses the balance in effect at each close, including after a send', () => {
    const values = pointsFor(
      [
        makeTx({
          id: 'a',
          received: 100_000_000,
          timestamp: new Date('2026-01-01T00:00:00Z'),
          type: 'receive'
        }),
        makeTx({
          id: 'b',
          received: 10_000_000,
          sent: 60_000_000,
          timestamp: new Date('2026-01-02T00:00:00Z'),
          type: 'send'
        })
      ],
      [40_000, 50_000],
      defaultRange
    )
    expect(values).toStrictEqual([40_000, 25_000])
  })
})

describe('fiatPointsInWindow', () => {
  const series = [
    { date: new Date('2026-01-01T00:00:00Z'), value: 10 },
    { date: new Date('2026-01-02T00:00:00Z'), value: 20 },
    { date: new Date('2026-01-03T00:00:00Z'), value: 30 },
    { date: new Date('2026-01-04T00:00:00Z'), value: 40 }
  ]

  function windowValues(start: string, end: string) {
    return fiatPointsInWindow(series, new Date(start), new Date(end)).map(
      (point) => point.value
    )
  }

  it('keeps one close beyond each edge so the line reaches the edges', () => {
    expect(
      windowValues('2026-01-02T12:00:00Z', '2026-01-03T12:00:00Z')
    ).toStrictEqual([20, 30, 40])
  })

  it('keeps the surrounding closes when the window falls between two', () => {
    expect(
      windowValues('2026-01-02T06:00:00Z', '2026-01-02T18:00:00Z')
    ).toStrictEqual([20, 30])
  })

  it('stops at the series ends', () => {
    expect(
      windowValues('2025-12-01T00:00:00Z', '2026-02-01T00:00:00Z')
    ).toStrictEqual([10, 20, 30, 40])
  })
})

describe('fiatSeriesColor', () => {
  it('colors each currency from its group', () => {
    expect(fiatSeriesColor('USD')).toBe(Colors.mutedGreen)
    expect(fiatSeriesColor('AUD')).toBe(Colors.mutedGreen)
    expect(fiatSeriesColor('EUR')).toBe(Colors.mutedCyan)
    expect(fiatSeriesColor('GBP')).toBe(Colors.mutedRed)
    expect(fiatSeriesColor('CAD')).toBe(Colors.mutedRed)
    expect(fiatSeriesColor('CHF')).toBe(Colors.mutedRed)
    expect(fiatSeriesColor('JPY')).toBe(Colors.mutedRed)
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

  it('falls back to the full series when the window has no fiat value', () => {
    expect(
      fiatDomainMax({
        fiatChartPoints: [
          { date: new Date('2026-01-01T00:00:00Z'), value: null },
          { date: new Date('2026-01-02T00:00:00Z'), value: 0 }
        ],
        lockZoomToXAxis: true,
        seriesMax: 80
      })
    ).toBe(80)
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

  it('keeps the top at exactly the fiat headroom so the top tick stays', () => {
    expect(
      fiatYDomain({
        lockZoomToXAxis: true,
        maxBalance: 13_501_427_264,
        maxFiat: 500,
        scale: 1,
        startY: 0
      })
    ).toStrictEqual([0, 600])
  })
})

describe('buildFiatLinePath', () => {
  it('breaks the line where a point has no fiat value', () => {
    const path = buildFiatLinePath(
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
      buildFiatLinePath(
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

describe('formatFiatAxisTick', () => {
  it('writes values below a thousand without SI prefixes', () => {
    expect(formatFiatAxisTick(0)).toBe('0')
    expect(formatFiatAxisTick(0.2)).toBe('0.2')
    expect(formatFiatAxisTick(0.1 + 0.2)).toBe('0.3')
    expect(formatFiatAxisTick(120)).toBe('120')
  })

  it('abbreviates thousands and millions', () => {
    expect(formatFiatAxisTick(1000)).toBe('1k')
    expect(formatFiatAxisTick(1500)).toBe('1.5k')
    expect(formatFiatAxisTick(12_345_678)).toBe('12.3M')
  })
})
