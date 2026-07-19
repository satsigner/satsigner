import { formatNumber } from '@/utils/format'

export const PRICE_CHART_DAYS = 30
export const PRICE_CHART_HEIGHT = 220
export const PRICE_CHART_LOADER_SIZE = 40
/** Matches `Layout.mainContainer.paddingHorizontal` (`6%`). */
export const MAIN_HORIZONTAL_PAD_RATIO = 0.06
const PRICE_DOMAIN_Y_PAD_RATIO = 0.1
const PRICE_DOMAIN_Y_PAD_FALLBACK = 1

export const PRICE_CHART_PADDING = {
  bottom: 28,
  left: 12,
  right: 28,
  top: 8
} as const

export const PRICE_CHART_TICK_COUNT = {
  x: 6,
  y: 5
} as const

export type PriceChartPoint = {
  price: number
  x: number
}

export type PriceChartDomain = {
  x: [number, number]
  y: [number, number]
}

function numberPair(a: number, b: number): [number, number] {
  return [a, b]
}

export function priceDomainFromData(
  data: PriceChartPoint[]
): PriceChartDomain | undefined {
  if (data.length === 0) {
    return undefined
  }
  const prices = data.map((d) => d.price).filter((p) => p > 0)
  const xValues = data.map((d) => d.x)
  if (prices.length === 0 || xValues.length === 0) {
    return undefined
  }
  const minY = Math.min(...prices)
  const maxY = Math.max(...prices)
  const padY =
    (maxY - minY) * PRICE_DOMAIN_Y_PAD_RATIO || PRICE_DOMAIN_Y_PAD_FALLBACK
  return {
    x: numberPair(Math.min(...xValues), Math.max(...xValues)),
    y: numberPair(minY - padY, maxY + padY)
  }
}

export function formatPriceChartDate(timestampSeconds: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short'
  }).format(new Date(timestampSeconds * 1000))
}

export function formatCompactFiat(value: number): string {
  if (value >= 1_000_000) {
    return `${formatNumber(value / 1_000_000, 1)}M`
  }
  if (value >= 1_000) {
    return `${formatNumber(value / 1_000, 0)}k`
  }
  return formatNumber(value, 0)
}

export function formatPriceChartXLabel(value: unknown): string {
  return formatPriceChartDate(Number(value))
}

export function formatPriceChartYLabel(value: unknown): string {
  return formatCompactFiat(Number(value))
}

export function formatSpotPriceDisplay(
  loading: boolean,
  spotPrice: number
): string {
  if (loading && spotPrice <= 0) {
    return '--'
  }
  if (spotPrice > 0) {
    return formatNumber(spotPrice, 0)
  }
  return '--'
}
