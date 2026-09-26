/**
 * Id of the node at one end (`source` / `target`) of a d3-sankey link. Links
 * are built with node ids; layout replaces them with the node objects, so read
 * laid-out links through this.
 */
export function getSankeyLinkEndId(
  end: string | number | { id: string }
): string {
  return typeof end === 'object' ? end.id : String(end)
}
