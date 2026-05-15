const EVENT_ID_HEX = /^[0-9a-fA-F]{64}$/

function listValidETags(tags: string[][]): string[][] {
  return tags.filter(
    (t) =>
      typeof t[0] === 'string' &&
      t[0].toLowerCase() === 'e' &&
      typeof t[1] === 'string' &&
      EVENT_ID_HEX.test(t[1])
  )
}

function eMarkerNorm(t: string[]): string {
  const raw = typeof t[3] === 'string' ? t[3] : ''
  return raw.trim().toLowerCase()
}

/**
 * NIP-10 style `e` tags: treat as a thread reply (vs quotes).
 * `mention` is for quotes or references, not the reply parent.
 * A lone `root` tag is treated as a reply to that note (common client variant).
 */
export function noteLooksLikeReply(tags: string[][]): boolean {
  const eTags = listValidETags(tags)
  if (eTags.length === 0) {
    return false
  }
  const markers = eTags.map((t) => eMarkerNorm(t))
  if (markers.some((m) => m === 'reply')) {
    return true
  }
  if (markers.every((m) => m === 'mention')) {
    return false
  }
  if (eTags.length >= 2) {
    if (markers.some((m) => m === 'mention')) {
      return false
    }
    return true
  }
  const [m0] = markers
  if (m0 === 'mention') {
    return false
  }
  if (m0 === 'root') {
    return true
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
  const replyMarked = eTags.find((t) => eMarkerNorm(t) === 'reply')
  if (replyMarked) {
    return replyMarked[1]
  }
  if (eTags.length >= 2) {
    return eTags.at(-1)![1]
  }
  return eTags[0][1]
}

export function getRelayHintForEventId(
  tags: string[][],
  eventIdHex: string
): string | undefined {
  const row = tags.find(
    (t) =>
      typeof t[0] === 'string' &&
      t[0].toLowerCase() === 'e' &&
      t[1] === eventIdHex
  )
  const url = row?.[2]
  if (typeof url !== 'string') {
    return undefined
  }
  if (url.startsWith('wss://') || url.startsWith('ws://')) {
    return url
  }
  return undefined
}
