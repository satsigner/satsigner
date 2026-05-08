/**
 * After d3-sankey layout, redistribute each column so stacked nodes share the
 * same vertical gap and equal row height (flow-sized node heights look uneven).
 */

type DepthHNode = {
  depthH: number
  y0?: number
  y1?: number
}

/** Vertical space needed to stack `n` rows with fixed gap (equalizeSankeyColumnsByDepthH). */
export function minSankeyStackedColumnInnerHeightPx(
  maxNodesInAnyColumn: number,
  minSlotPx: number,
  gapPx: number
): number {
  const n = Math.max(1, Math.floor(maxNodesInAnyColumn))
  return n * minSlotPx + Math.max(0, n - 1) * gapPx
}

export function equalizeSankeyColumnsByDepthH<T extends DepthHNode>(
  nodes: T[],
  extentTop: number,
  extentBottom: number,
  requestedGapPx: number,
  minSlotHeightPx: number
): void {
  const H = extentBottom - extentTop
  if (H <= 0 || nodes.length === 0) {
    return
  }

  const gapRequest = Math.max(0, requestedGapPx)

  const byDepth = new Map<number, T[]>()
  for (const node of nodes) {
    const d = node.depthH
    const existing = byDepth.get(d)
    if (existing) {
      existing.push(node)
    } else {
      byDepth.set(d, [node])
    }
  }

  for (const [, col] of byDepth) {
    col.sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0))
    const n = col.length

    if (n === 1) {
      const [node] = col
      const prevSpan = (node.y1 ?? 0) - (node.y0 ?? 0)
      const rawH = Math.max(prevSpan, minSlotHeightPx)
      const h = Math.min(rawH, H)
      const y0 = extentTop + (H - h) / 2
      node.y0 = y0
      node.y1 = y0 + h
      continue
    }

    let gap = gapRequest
    let slotH = (H - (n - 1) * gap) / n

    if (slotH < minSlotHeightPx && n > 1) {
      gap = Math.max(0, (H - n * minSlotHeightPx) / (n - 1))
      slotH = (H - (n - 1) * gap) / n
    }

    if (slotH < 0) {
      slotH = H / n
      gap = 0
    }

    for (let i = 0; i < n; i += 1) {
      const node = col[i]
      const y0 = extentTop + i * (slotH + gap)
      node.y0 = y0
      node.y1 = y0 + slotH
    }
  }
}
