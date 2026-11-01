import {
  applyIfLatest,
  createLatestRequestTracker
} from '@/utils/latestRequest'

describe('createLatestRequestTracker', () => {
  it('treats only the newest request as latest', () => {
    const tracker = createLatestRequestTracker()

    const isFirstLatest = tracker.beginRequest()
    expect(isFirstLatest()).toBe(true)

    const isSecondLatest = tracker.beginRequest()
    expect(isFirstLatest()).toBe(false)
    expect(isSecondLatest()).toBe(true)
  })

  it('keeps trackers independent', () => {
    const first = createLatestRequestTracker()
    const second = createLatestRequestTracker()

    const isFirstLatest = first.beginRequest()
    second.beginRequest()

    expect(isFirstLatest()).toBe(true)
  })
})

describe('applyIfLatest', () => {
  it('drops values from a superseded request', () => {
    const tracker = createLatestRequestTracker()
    const apply = jest.fn()

    const applyOutdated = applyIfLatest(tracker.beginRequest(), apply)
    const applyCurrent = applyIfLatest(tracker.beginRequest(), apply)

    applyCurrent('new inputs')
    applyOutdated('old inputs')

    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith('new inputs')
  })
})
