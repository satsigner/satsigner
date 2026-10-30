import {
  type SankeyExtraProperties,
  type SankeyGraph,
  type SankeyLayout
} from 'd3-sankey'

/**
 * Lays out copies of the nodes and links. d3-sankey writes positions onto the
 * nodes it receives and swaps each link's source/target id for a node object,
 * so laying out memoized arrays in place leaves links bound to stale nodes once
 * only the nodes are rebuilt, and hides new positions behind unchanged arrays.
 */
export function layoutSankeyGraph<
  N extends SankeyExtraProperties,
  L extends SankeyExtraProperties
>(
  sankeyGenerator: SankeyLayout<SankeyGraph<N, L>, N, L>,
  graph: SankeyGraph<N, L>
): SankeyGraph<N, L> {
  return sankeyGenerator({
    links: graph.links.map((link) => ({ ...link })),
    nodes: graph.nodes.map((node) => ({ ...node }))
  })
}
