import { HISTORY_CHART_Y_HEADROOM, satsYDomain } from '@/utils/historyChart'

const MIN_SCALE = 1

export type HistoryChartViewportState = {
  endMs: number
  scale: number
  startY: number
}

type ViewportBounds = {
  timeOffset: number
  chartWidth: number
  chartHeight: number
  maxBalance: number
  lockZoomToXAxis: boolean
  nowMs: number
  firstTxMs: number
}

type PanParams = ViewportBounds & {
  origin: HistoryChartViewportState
  live: HistoryChartViewportState
  translationX: number
  translationY: number
}

type PinchParams = {
  timeOffset: number
  maxBalance: number
  originScale: number
  live: HistoryChartViewportState
  pinchScale: number
}

type TransformParams = {
  rendered: HistoryChartViewportState
  live: HistoryChartViewportState
  timeOffset: number
  chartWidth: number
  chartHeight: number
  maxBalance: number
  lockZoomToXAxis: boolean
}

function clamp(value: number, min: number, max: number) {
  'worklet'
  return Math.max(Math.min(value, max), min)
}

function clampStartY(startY: number, scale: number, maxBalance: number) {
  'worklet'
  const ySpan = maxBalance * HISTORY_CHART_Y_HEADROOM
  return clamp(startY, 0, ySpan - ySpan / scale)
}

export function panViewport({
  origin,
  live,
  translationX,
  translationY,
  timeOffset,
  chartWidth,
  chartHeight,
  maxBalance,
  lockZoomToXAxis,
  nowMs,
  firstTxMs
}: PanParams): HistoryChartViewportState {
  'worklet'
  const visibleSpan = timeOffset / live.scale
  const endMs = clamp(
    origin.endMs - (visibleSpan * translationX) / chartWidth,
    firstTxMs,
    nowMs + visibleSpan
  )
  if (lockZoomToXAxis) {
    return { ...live, endMs }
  }
  const ySpan = maxBalance * HISTORY_CHART_Y_HEADROOM
  const startY = clampStartY(
    origin.startY + ((ySpan / live.scale) * translationY) / chartHeight,
    live.scale,
    maxBalance
  )
  return { ...live, endMs, startY }
}

export function pinchViewport({
  timeOffset,
  maxBalance,
  originScale,
  live,
  pinchScale
}: PinchParams): HistoryChartViewportState {
  'worklet'
  const scale = Math.max(originScale * pinchScale, MIN_SCALE)
  const middleMs = live.endMs - timeOffset / live.scale / 2
  return {
    endMs: middleMs + timeOffset / scale / 2,
    scale,
    startY: clampStartY(live.startY, scale, maxBalance)
  }
}

// Maps pixels drawn for the rendered viewport onto the live one, so gestures
// move the canvas on the UI thread without a React render per frame.
export function viewportTransform({
  rendered,
  live,
  timeOffset,
  chartWidth,
  chartHeight,
  maxBalance,
  lockZoomToXAxis
}: TransformParams) {
  'worklet'
  const renderedSpan = timeOffset / rendered.scale
  const liveSpan = timeOffset / live.scale
  const renderedStartMs = rendered.endMs - renderedSpan
  const liveStartMs = live.endMs - liveSpan
  const scaleX = renderedSpan / liveSpan
  const translateX = ((renderedStartMs - liveStartMs) / liveSpan) * chartWidth

  const [renderedY0, renderedY1] = satsYDomain({
    lockZoomToXAxis,
    maxBalance,
    scale: rendered.scale,
    startY: rendered.startY
  })
  const [liveY0, liveY1] = satsYDomain({
    lockZoomToXAxis,
    maxBalance,
    scale: live.scale,
    startY: live.startY
  })
  const liveYSpan = liveY1 - liveY0
  const scaleY = liveYSpan > 0 ? (renderedY1 - renderedY0) / liveYSpan : 1
  const translateY =
    liveYSpan > 0 ? chartHeight * (1 - (renderedY1 - liveY0) / liveYSpan) : 0

  return { scaleX, scaleY, translateX, translateY }
}
