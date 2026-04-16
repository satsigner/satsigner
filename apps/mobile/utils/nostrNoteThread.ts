/**
 * NIP-10 style `e` tags: treat as a reply (vs thread root only) for UI badges.
 */
export function noteLooksLikeReply(tags: string[][]): boolean {
  const eTags = tags.filter(
    (t) =>
      t[0] === 'e' &&
      typeof t[1] === 'string' &&
      /^[0-9a-fA-F]{64}$/.test(t[1])
  )
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
