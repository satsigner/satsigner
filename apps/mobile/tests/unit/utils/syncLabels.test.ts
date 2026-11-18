import { syncProgressLabel, syncTickerLabels } from '@/utils/syncLabels'

describe('syncProgressLabel', () => {
  it('shows a plain syncing label without a total', () => {
    expect(syncProgressLabel({ tasksDone: 3, totalTasks: 0 })).toBe(
      'Syncing...'
    )
  })

  it('counts addresses for address syncs', () => {
    expect(
      syncProgressLabel({ tasksDone: 2, totalTasks: 45, unit: 'addresses' })
    ).toBe('02/45 addresses')
  })

  it('pads the count to the total digits', () => {
    expect(
      syncProgressLabel({ tasksDone: 7, totalTasks: 1000, unit: 'addresses' })
    ).toBe('0007/1000 addresses')
  })

  it('shows block heights for block scans', () => {
    expect(
      syncProgressLabel({ tasksDone: 50, totalTasks: 100, unit: 'blocks' })
    ).toBe('50 / 100 — 50%')
  })
})

describe('syncTickerLabels', () => {
  it('alternates progress with the check kind', () => {
    expect(
      syncTickerLabels({
        scope: 'full',
        tasksDone: 2,
        totalTasks: 45,
        unit: 'addresses'
      })
    ).toStrictEqual(['02/45 addresses', 'Full check'])
  })

  it('names quick checks', () => {
    expect(
      syncTickerLabels({ scope: 'quick', tasksDone: 1, totalTasks: 10 })[1]
    ).toBe('Quick check')
  })

  it('shows only progress when the scope is unknown', () => {
    expect(syncTickerLabels({ tasksDone: 0, totalTasks: 0 })).toStrictEqual([
      'Syncing...'
    ])
  })
})
