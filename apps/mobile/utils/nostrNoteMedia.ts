const IMAGE_FILE_EXT_RE = /\.(?:jpg|jpeg|png|gif|webp|avif|bmp)(?:\?[^\s]*)?$/i
const MARKDOWN_IMAGE_RE = /!\[[^\]]*]\((https?:[^)\s]+)\)/gi
const BARE_URL_RE = /https?:\/\/[^\s<>"')]+/gi

export function isPlausibleImageHttpUrl(url: string): boolean {
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) {
    return false
  }
  if (IMAGE_FILE_EXT_RE.test(u)) {
    return true
  }
  if (/nostr\.build|blossom|\/nip95|\/image\//i.test(u)) {
    return true
  }
  return false
}

/**
 * Removes already-rendered image URLs (and their markdown syntax) from note
 * content text, collapsing excess blank lines left behind.
 */
export function stripImageUrlsFromContent(
  content: string,
  urls: string[]
): string {
  if (urls.length === 0) {
    return content
  }
  const urlSet = new Set(urls)
  const withoutMarkdown = content.replace(
    MARKDOWN_IMAGE_RE,
    (match, url: string) =>
      urlSet.has(url.trim().replace(/\)+$/, '')) ? '' : match
  )
  const withoutBare = withoutMarkdown.replace(BARE_URL_RE, (match) =>
    urlSet.has(match.trim().replace(/\)+$/, '')) ? '' : match
  )
  return withoutBare.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Collects http(s) image URLs from kind-1 `imeta` tags (NIP-92), markdown
 * `![](url)`, and bare image-like https URLs in `content`.
 */
export function extractImageUrlsFromNote(
  content: string,
  tags: string[][]
): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  function push(raw: string) {
    const u = raw.trim().replace(/\)+$/, '')
    if (!u || seen.has(u)) {
      return
    }
    if (!isPlausibleImageHttpUrl(u)) {
      return
    }
    seen.add(u)
    urls.push(u)
  }

  for (const tag of tags) {
    if (tag[0] !== 'imeta') {
      continue
    }
    for (let i = 1; i < tag.length; i += 1) {
      const part = tag[i]
      if (typeof part !== 'string') {
        continue
      }
      if (part.startsWith('url ')) {
        push(part.slice(4))
      }
    }
  }

  for (const match of content.matchAll(/!\[[^\]]*]\((https?:[^)\s]+)\)/gi)) {
    push(match[1])
  }

  for (const match of content.matchAll(/https?:\/\/[^\s<>"')]+/gi)) {
    push(match[0])
  }

  return urls
}
