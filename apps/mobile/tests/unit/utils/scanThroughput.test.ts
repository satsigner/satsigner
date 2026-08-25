import { createScanThroughputTracker } from '@/utils/scanThroughput'

describe('createScanThroughputTracker', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns null rate until enough samples accumulate', () => {
    const tracker = createScanThroughputTracker()
    const first = tracker.update(100, 1000, true)
    expect(first.blocksPerSec).toBeNull()
    expect(first.pct).toBe(10)
  })

  it('computes blocks/sec and eta from height progress', () => {
    const tracker = createScanThroughputTracker()
    tracker.update(100, 1000, true)
    jest.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const next = tracker.update(300, 1000, true)
    expect(next.blocksPerSec).toBe(20)
    expect(next.etaSeconds).toBe(35) // 700 remaining / 20
    expect(next.pct).toBe(30)
  })

  it('clears samples when inactive', () => {
    const tracker = createScanThroughputTracker()
    tracker.update(100, 1000, true)
    jest.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    tracker.update(300, 1000, true)
    const cleared = tracker.update(300, 1000, false)
    expect(cleared.blocksPerSec).toBeNull()
    expect(cleared.pct).toBe(0)
  })
})
