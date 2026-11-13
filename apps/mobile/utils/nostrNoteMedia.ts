const IMAGE_FILE_EXT_RE = /\.(?:jpg|jpeg|png|gif|webp|avif|bmp)(?:\?[^\s]*)?$/i
export const VIDEO_FILE_EXT_RE = /\.(?:mp4|webm|mov|m3u8)(?:\?[^\s]*)?$/i
const IMAGE_HOST_HINT_RE = /nostr\.build|blossom|\/nip95|\/image\//i
const IMAGE_MIME_PREFIX = 'image/'
const MARKDOWN_IMAGE_RE = /!\[[^\]]*]\((https?:[^)\s]+)\)/gi
const BARE_URL_RE = /https?:\/\/[^\s<>"')]+/gi
const IMETA_DIM_RE = /^(\d+)x(\d+)$/

export type NostrImetaInfo = {
  aspectRatio?: number
  image?: string
  mime?: string
}

function aspectRatioFromDim(dim: string | undefined): number | undefined {
  const match = dim ? IMETA_DIM_RE.exec(dim) : null
  const width = Number(match?.[1])
  const height = Number(match?.[2])
  return width > 0 && height > 0 ? width / height : undefined
}

function imetaField(tag: string[], name: string): string | undefined {
  const prefix = `${name} `
  return tag
    .find((part) => typeof part === 'string' && part.startsWith(prefix))
    ?.slice(prefix.length)
    .trim()
}

/** NIP-92 `imeta` details (dimensions, poster image, mime type) per url. */
export function parseImetaByUrl(tags: string[][]): Map<string, NostrImetaInfo> {
  return new Map(
    tags.flatMap((tag) => {
      const url = tag[0] === 'imeta' ? imetaField(tag, 'url') : undefined
      if (!url) {
        return []
      }
      const info: NostrImetaInfo = {
        aspectRatio: aspectRatioFromDim(imetaField(tag, 'dim')),
        image: imetaField(tag, 'image'),
        mime: imetaField(tag, 'm')?.toLowerCase()
      }
      return [[url, info]]
    })
  )
}

/**
 * Whether a url renders as an inline image: by its declared imeta mime type,
 * else by its file extension, else by hosts that serve extensionless images.
 * A video is never an image, or it would load before the user taps to play it.
 */
export function isPlausibleImageHttpUrl(url: string, mime?: string): boolean {
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) {
    return false
  }
  if (mime) {
    return mime.startsWith(IMAGE_MIME_PREFIX)
  }
  if (IMAGE_FILE_EXT_RE.test(u)) {
    return true
  }
  return !VIDEO_FILE_EXT_RE.test(u) && IMAGE_HOST_HINT_RE.test(u)
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
  return withoutBare.replaceAll(/\n{3,}/g, '\n\n').trim()
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
  const imetaByUrl = parseImetaByUrl(tags)

  function push(raw: string) {
    const u = raw.trim().replace(/\)+$/, '')
    if (!u || seen.has(u)) {
      return
    }
    if (!isPlausibleImageHttpUrl(u, imetaByUrl.get(u)?.mime)) {
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
