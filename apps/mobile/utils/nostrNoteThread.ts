const EVENT_ID_HEX = /^[0-9a-fA-F]{64}$/

function listValidETags(tags: string[][]): string[][] {
  return tags.filter(
    (t) =>
      t[0] === 'e' &&
      typeof t[1] === 'string' &&
      EVENT_ID_HEX.test(t[1])
  )
}

/**
 * NIP-10 style `e` tags: treat as a reply (vs thread root only) for UI badges.
 */
export function noteLooksLikeReply(tags: string[][]): boolean {
  const eTags = listValidETags(tags)
  if (eTags.length === 0) {
    return false
  }
  if (eTags.some((t) => t[3] === 'reply')) {
    return true
  }
  if (eTags.length >= 2) {
    return true
  }
  const marker = eTags[0][3]
  if (marker === 'root') {
    return false
  }
  return true
}

/**
 * Immediate parent note id for a reply (NIP-10 `e` tag with `reply`, else
 * legacy last `e` when multiple, else single non-root `e`).
 */
export function getReplyParentEventIdHex(tags: string[][]): string | null {
  if (!noteLooksLikeReply(tags)) {
    return null
  }
  const eTags = listValidETags(tags)
  if (eTags.length === 0) {
    return null
  }
  const replyMarked = eTags.find((t) => t[3] === 'reply')
  if (replyMarked) {
    return replyMarked[1]
  }
  if (eTags.length >= 2) {
    return eTags[eTags.length - 1][1]
  }
  return eTags[0][1]
}

export function getRelayHintForEventId(
  tags: string[][],
  eventIdHex: string
): string | undefined {
  const row = tags.find((t) => t[0] === 'e' && t[1] === eventIdHex)
  const url = row?.[2]
  if (typeof url !== 'string') {
    return undefined
  }
  if (url.startsWith('wss://') || url.startsWith('ws://')) {
    return url
  }
  return undefined
}
