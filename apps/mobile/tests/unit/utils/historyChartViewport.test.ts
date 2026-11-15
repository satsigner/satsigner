import {
  panViewport,
  pinchViewport,
  viewportTransform
} from '@/utils/historyChartViewport'

const DAY_MS = 86_400_000
const TIME_OFFSET = 100 * DAY_MS
const NOW_MS = 1000 * DAY_MS
const CHART_WIDTH = 300
const CHART_HEIGHT = 200
const MAX_BALANCE = 1000

const bounds = {
  chartHeight: CHART_HEIGHT,
  chartWidth: CHART_WIDTH,
  firstTxMs: NOW_MS - 500 * DAY_MS,
  lockZoomToXAxis: false,
  maxBalance: MAX_BALANCE,
  nowMs: NOW_MS,
  timeOffset: TIME_OFFSET
}

const origin = { endMs: NOW_MS - 50 * DAY_MS, scale: 2, startY: 100 }

function toLivePixel(renderedPixel: number, scale: number, translate: number) {
  return translate + scale * renderedPixel
}

describe('panViewport', () => {
  it('moves the end date back by the dragged fraction of the window', () => {
    const next = panViewport({
      ...bounds,
      live: origin,
      origin,
      translationX: CHART_WIDTH / 2,
      translationY: 0
    })
    expect(next.endMs).toBe(origin.endMs - TIME_OFFSET / 2 / 2)
    expect(next.startY).toBe(origin.startY)
  })

  it('clamps the end date to the first transaction', () => {
    const next = panViewport({
      ...bounds,
      live: origin,
      origin,
      translationX: CHART_WIDTH * 100,
      translationY: 0
    })
    expect(next.endMs).toBe(bounds.firstTxMs)
  })

  it('clamps the end date to one window past now', () => {
    const next = panViewport({
      ...bounds,
      live: origin,
      origin,
      translationX: -CHART_WIDTH * 100,
      translationY: 0
    })
    expect(next.endMs).toBe(NOW_MS + TIME_OFFSET / origin.scale)
  })

  it('keeps startY when zoom is locked to the x axis', () => {
    const next = panViewport({
      ...bounds,
      live: origin,
      lockZoomToXAxis: true,
      origin,
      translationX: 0,
      translationY: CHART_HEIGHT
    })
    expect(next.startY).toBe(origin.startY)
  })

  it('clamps startY within the zoomed vertical span', () => {
    const next = panViewport({
      ...bounds,
      live: origin,
      origin,
      translationX: 0,
      translationY: CHART_HEIGHT * 100
    })
    const ySpan = MAX_BALANCE * 1.2
    expect(next.startY).toBe(ySpan - ySpan / origin.scale)
  })
})

describe('pinchViewport', () => {
  it('zooms around the middle of the visible window', () => {
    const next = pinchViewport({
      live: origin,
      originScale: origin.scale,
      pinchScale: 2,
      timeOffset: TIME_OFFSET
    })
    const middle = (viewport: typeof origin) =>
      viewport.endMs - TIME_OFFSET / viewport.scale / 2
    expect(next.scale).toBe(4)
    expect(middle(next)).toBe(middle(origin))
  })

  it('never zooms out past the full history', () => {
    const next = pinchViewport({
      live: origin,
      originScale: origin.scale,
      pinchScale: 0.1,
      timeOffset: TIME_OFFSET
    })
    expect(next.scale).toBe(1)
  })
})

describe('viewportTransform', () => {
  const transformParams = {
    chartHeight: CHART_HEIGHT,
    chartWidth: CHART_WIDTH,
    lockZoomToXAxis: false,
    maxBalance: MAX_BALANCE,
    timeOffset: TIME_OFFSET
  }

  it('is the identity when the live viewport matches the rendered one', () => {
    expect(
      viewportTransform({ ...transformParams, live: origin, rendered: origin })
    ).toStrictEqual({ scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 })
  })

  it('maps rendered pixels to where the live viewport would draw them', () => {
    const live = { endMs: origin.endMs - 10 * DAY_MS, scale: 3, startY: 150 }
    const { scaleX, scaleY, translateX, translateY } = viewportTransform({
      ...transformParams,
      live,
      rendered: origin
    })

    const timeMs = origin.endMs - 20 * DAY_MS
    const xFor = (viewport: typeof origin) => {
      const span = TIME_OFFSET / viewport.scale
      return ((timeMs - (viewport.endMs - span)) / span) * CHART_WIDTH
    }
    expect(toLivePixel(xFor(origin), scaleX, translateX)).toBeCloseTo(
      xFor(live)
    )

    const balance = 400
    const yFor = (viewport: typeof origin) => {
      const span = (MAX_BALANCE * 1.2) / viewport.scale
      return CHART_HEIGHT * (1 - (balance - viewport.startY) / span)
    }
    expect(toLivePixel(yFor(origin), scaleY, translateY)).toBeCloseTo(
      yFor(live)
    )
  })
})
