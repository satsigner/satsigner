import { sankey } from 'd3-sankey'

import { layoutSankeyGraph } from '@/utils/sankeyLayout'

type TestNode = { id: string; depthH: number; value: number }
type TestLink = { source: string; target: string; value: number }

const EXTENT_BOTTOM_PX = 300
const EXTENT_RIGHT_PX = 300
const NODE_PADDING_PX = 10
const NODE_WIDTH_PX = 10

function createSankeyGenerator() {
  return sankey<TestNode, TestLink>()
    .nodeWidth(NODE_WIDTH_PX)
    .nodePadding(NODE_PADDING_PX)
    .extent([
      [0, 0],
      [EXTENT_RIGHT_PX, EXTENT_BOTTOM_PX]
    ])
    .nodeId((node) => node.id)
    .nodeAlign((node) => node.depthH)
}

function createNodes(): TestNode[] {
  return [
    { depthH: 0, id: 'input', value: 600 },
    { depthH: 1, id: 'block', value: 600 },
    { depthH: 2, id: 'payment', value: 400 },
    { depthH: 2, id: 'change', value: 200 }
  ]
}

function createLinks(): TestLink[] {
  return [
    { source: 'input', target: 'block', value: 600 },
    { source: 'block', target: 'payment', value: 400 },
    { source: 'block', target: 'change', value: 200 }
  ]
}

describe('layoutSankeyGraph', () => {
  it('lays out the graph without mutating the given nodes or links', () => {
    const nodes = createNodes()
    const links = createLinks()

    const layout = layoutSankeyGraph(createSankeyGenerator(), { links, nodes })

    expect(nodes).toStrictEqual(createNodes())
    expect(links).toStrictEqual(createLinks())
    expect(layout.nodes).not.toBe(nodes)
    expect(layout.links).not.toBe(links)
    expect(layout.nodes.map((node) => node.value)).toStrictEqual([
      600, 600, 400, 200
    ])
    expect(layout.nodes.every((node) => Number.isFinite(node.y0))).toBe(true)
  })

  it('lays out rebuilt nodes against links reused from an earlier layout', () => {
    const sankeyGenerator = createSankeyGenerator()
    const links = createLinks()
    const firstLayout = layoutSankeyGraph(sankeyGenerator, {
      links,
      nodes: createNodes()
    })

    const secondLayout = layoutSankeyGraph(sankeyGenerator, {
      links,
      nodes: createNodes()
    })

    expect(secondLayout.nodes.map((node) => node.value)).toStrictEqual(
      firstLayout.nodes.map((node) => node.value)
    )
    expect(secondLayout.nodes.map((node) => node.y0)).toStrictEqual(
      firstLayout.nodes.map((node) => node.y0)
    )
  })
})
