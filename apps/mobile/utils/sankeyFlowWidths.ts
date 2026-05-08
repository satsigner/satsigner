import {
  SANKEY_BAND_HEIGHT_MAX_PX,
  SANKEY_BAND_HEIGHT_MIN_PX,
  SANKEY_RIBBON_DUST_MIN_PX
} from '@/types/ui/sankey'

import { logAttenuation } from './math'

export type SankeyRibbonPlan = {
  bandHeightByBlockId: ReadonlyMap<string, number>
  linkWidthByKey: ReadonlyMap<string, number>
}

type RibbonNode = {
  id: string
  type: string
  value?: number
}

type RibbonLink = {
  source: string
  target: string
  value: number
}

export function linkRibbonKey(source: string, target: string): string {
  return `${source}\x1E${target}`
}

export function totalThroughputToBandHeight(totalValue: number): number {
  if (totalValue <= 0) {
    return SANKEY_BAND_HEIGHT_MIN_PX
  }
  const raw = logAttenuation(totalValue)
  return Math.min(
    Math.max(raw, SANKEY_BAND_HEIGHT_MIN_PX),
    SANKEY_BAND_HEIGHT_MAX_PX
  )
}

export function linearShareWidths(
  values: readonly number[],
  totalPx: number,
  minRibbonPx = 0
): number[] {
  const n = values.length
  if (n === 0) {
    return []
  }
  if (totalPx <= 0) {
    return values.map(() => 0)
  }

  const sum = values.reduce((acc, v) => acc + v, 0)
  if (sum <= 0) {
    const uniform = totalPx / n
    return values.map(() => uniform)
  }

  let widths = values.map((v) => (v / sum) * totalPx)

  if (minRibbonPx > 0) {
    widths = widths.map((w) => Math.max(w, minRibbonPx))
  }

  const scaledSum = widths.reduce((acc, w) => acc + w, 0)
  if (scaledSum <= 0) {
    return widths
  }

  if (Math.abs(scaledSum - totalPx) > 1e-6) {
    widths = widths.map((w) => (w / scaledSum) * totalPx)
  }

  return widths
}

export function buildSankeyRibbonPlan(
  nodes: readonly RibbonNode[],
  links: readonly RibbonLink[]
): SankeyRibbonPlan {
  const linkWidthByKey = new Map<string, number>()
  const bandHeightByBlockId = new Map<string, number>()

  const blocks = nodes.filter((n) => n.type === 'block')

  for (const block of blocks) {
    const inputLinks = links.filter((l) => l.target === block.id)
    const outputLinks = links.filter((l) => l.source === block.id)

    const sumIn = inputLinks.reduce((s, l) => s + l.value, 0)
    const sumOut = outputLinks.reduce((s, l) => s + l.value, 0)
    const throughput =
      sumIn > 0 ? sumIn : sumOut > 0 ? sumOut : (block.value ?? 0)

    const H = totalThroughputToBandHeight(throughput)
    bandHeightByBlockId.set(block.id, H)

    const inputWidths = linearShareWidths(
      inputLinks.map((l) => l.value),
      H,
      SANKEY_RIBBON_DUST_MIN_PX
    )
    for (let i = 0; i < inputLinks.length; i += 1) {
      const l = inputLinks[i]
      linkWidthByKey.set(linkRibbonKey(l.source, l.target), inputWidths[i] ?? 0)
    }

    const outputWidths = linearShareWidths(
      outputLinks.map((l) => l.value),
      H,
      SANKEY_RIBBON_DUST_MIN_PX
    )
    for (let i = 0; i < outputLinks.length; i += 1) {
      const l = outputLinks[i]
      linkWidthByKey.set(
        linkRibbonKey(l.source, l.target),
        outputWidths[i] ?? 0
      )
    }
  }

  return { bandHeightByBlockId, linkWidthByKey }
}

export function ribbonWidthForLink(
  plan: SankeyRibbonPlan,
  sourceId: string,
  targetId: string
): number {
  return plan.linkWidthByKey.get(linkRibbonKey(sourceId, targetId)) ?? 0
}

type StackNode = {
  id: string
  y0?: number
  y1?: number
}

export function stackedRibbonOffsetBeforeLink(
  node: StackNode,
  isSource: boolean,
  currentLink: Pick<RibbonLink, 'source' | 'target'>,
  links: readonly Pick<RibbonLink, 'source' | 'target'>[],
  nodes: readonly StackNode[],
  plan: SankeyRibbonPlan
): number {
  const relevantLinks = links
    .filter((link) => {
      if (isSource) {
        return link.source === node.id
      }
      return link.target === node.id
    })
    .toSorted((a, b) => {
      const aNode = isSource
        ? nodes.find((n) => n.id === a.target)
        : nodes.find((n) => n.id === a.source)
      const bNode = isSource
        ? nodes.find((n) => n.id === b.target)
        : nodes.find((n) => n.id === b.source)

      const aY = isSource ? (aNode?.y0 ?? 0) : (aNode?.y1 ?? 0)
      const bY = isSource ? (bNode?.y0 ?? 0) : (bNode?.y1 ?? 0)

      return aY - bY
    })

  const currentLinkIndex = relevantLinks.findIndex((link) =>
    isSource
      ? link.target === currentLink.target
      : link.source === currentLink.source
  )

  let cumulativeHeight = 0
  for (let i = 0; i < currentLinkIndex; i += 1) {
    const link = relevantLinks[i]
    cumulativeHeight += ribbonWidthForLink(plan, link.source, link.target)
  }

  return cumulativeHeight
}
