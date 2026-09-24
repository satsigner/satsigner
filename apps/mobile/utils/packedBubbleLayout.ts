import { hierarchy, pack } from 'd3-hierarchy'

const MIN_BUBBLE_RADIUS = 16
const CHART_PADDING = 8
const DEFAULT_PACK_PADDING = 4
const MIN_FONT_PX = 7
const MAX_FONT_PX = 11
const FONT_RADIUS_RATIO = 0.55

export type PackedBubbleDatum = {
  id: string
  value: number
  label: string
  locked?: boolean
  selected?: boolean
}

export type PackedBubbleLeaf = {
  cx: number
  cy: number
  datum: PackedBubbleDatum
  fontSize: number
  id: string
  r: number
}

type PackNode = {
  children: PackNode[]
  datum?: PackedBubbleDatum
  id: string
  value: number
}

export type PackedBubbleLayout = {
  chartSize: number
  leaves: PackedBubbleLeaf[]
}

function buildPackedBubbleLayout(
  data: PackedBubbleDatum[],
  width: number,
  height: number
): PackedBubbleLayout {
  const chartSize = Math.min(width, height)

  const root = hierarchy<PackNode>({
    children: data.map((datum) => ({
      children: [],
      datum,
      id: datum.id,
      value: datum.value
    })),
    id: 'root',
    value: 0
  }).sum((d) => Math.max(d.value, 1))

  // d3 HierarchyNode.sort() is not Array.sort — .toSorted() does not exist on it
  root.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const packLayout = pack<PackNode>()
    .size([chartSize - CHART_PADDING * 2, chartSize - CHART_PADDING * 2])
    .padding(DEFAULT_PACK_PADDING)

  const leaves = packLayout(root)
    .leaves()
    .flatMap((leaf) => {
      const { datum } = leaf.data
      if (!datum) {
        return []
      }

      const r = Math.max(leaf.r, MIN_BUBBLE_RADIUS)
      return [
        {
          cx: leaf.x + CHART_PADDING,
          cy: leaf.y + CHART_PADDING,
          datum,
          fontSize: Math.max(
            MIN_FONT_PX,
            Math.min(MAX_FONT_PX, r * FONT_RADIUS_RATIO)
          ),
          id: datum.id,
          r
        }
      ]
    })

  return { chartSize, leaves }
}

export { buildPackedBubbleLayout }
