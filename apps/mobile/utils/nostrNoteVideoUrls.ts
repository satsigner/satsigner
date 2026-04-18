import { isPlausibleImageHttpUrl } from '@/utils/nostrNoteMedia'

export type NostrVideoProvider =
  | 'youtube'
  | 'vimeo'
  | 'twitch_vod'
  | 'twitch_clip'
  | 'direct'

export type NostrVideoEmbed = {
  provider: NostrVideoProvider
  watchUrl: string
  thumbnailUrl?: string
}

function pushUrl(raw: string, seen: Set<string>, out: string[]) {
  const u = raw.trim().replace(/\)+$/, '')
  if (!u || seen.has(u)) {
    return
  }
  seen.add(u)
  out.push(u)
}

function collectHttpUrlsFromNote(content: string, tags: string[][]): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  for (const tag of tags) {
    if (tag[0] !== 'imeta') {
      continue
    }
    for (let i = 1; i < tag.length; i++) {
      const part = tag[i]
      if (typeof part !== 'string') {
        continue
      }
      if (part.startsWith('url ')) {
        pushUrl(part.slice(4), seen, urls)
      }
    }
  }

  for (const match of content.matchAll(/!\[[^\]]*]\((https?:[^)\s]+)\)/gi)) {
    pushUrl(match[1], seen, urls)
  }

  for (const match of content.matchAll(/https?:\/\/[^\s<>"')]+/gi)) {
    pushUrl(match[0], seen, urls)
  }

  return urls
}

function parseYouTubeEmbed(url: string): NostrVideoEmbed | null {
  const u = url.trim()
  const m = u.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})\b/i
  )
  if (!m) {
    return null
  }
  const id = m[1]
  const watchUrl = `https://www.youtube.com/watch?v=${id}`
  return {
    provider: 'youtube',
    thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    watchUrl
  }
}

function parseVimeoEmbed(url: string): NostrVideoEmbed | null {
  const u = url.trim()
  const m = u.match(/vimeo\.com\/(?:video\/)?(\d{6,})\b/i)
  if (!m) {
    return null
  }
  const id = m[1]
  return {
    provider: 'vimeo',
    watchUrl: `https://vimeo.com/${id}`
  }
}

function parseTwitchVodEmbed(url: string): NostrVideoEmbed | null {
  const u = url.trim()
  const m = u.match(/twitch\.tv\/videos\/(\d+)\b/i)
  if (!m) {
    return null
  }
  return {
    provider: 'twitch_vod',
    watchUrl: u.split('?')[0]
  }
}

function parseTwitchClipEmbed(url: string): NostrVideoEmbed | null {
  const u = url.trim()
  const clip = u.match(/clips\.twitch\.tv\/([a-zA-Z0-9_-]+)\/?/i)
  if (clip) {
    return {
      provider: 'twitch_clip',
      watchUrl: `https://clips.twitch.tv/${clip[1]}`
    }
  }
  const m = u.match(/twitch\.tv\/\w+\/clip\/([a-zA-Z0-9_-]+)\/?/i)
  if (!m) {
    return null
  }
  return {
    provider: 'twitch_clip',
    watchUrl: `https://clips.twitch.tv/${m[1]}`
  }
}

function parseDirectVideoEmbed(url: string): NostrVideoEmbed | null {
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) {
    return null
  }
  if (!/\.(?:mp4|webm|mov|m3u8)(?:\?[^\s]*)?$/i.test(u)) {
    return null
  }
  return {
    provider: 'direct',
    watchUrl: u
  }
}

function parseVideoEmbedFromUrl(url: string): NostrVideoEmbed | null {
  return (
    parseYouTubeEmbed(url) ||
    parseVimeoEmbed(url) ||
    parseTwitchVodEmbed(url) ||
    parseTwitchClipEmbed(url) ||
    parseDirectVideoEmbed(url)
  )
}

/**
 * Video links in kind-1 note `content` / `imeta` url tags (YouTube, Vimeo,
 * Twitch, direct https video files). Skips URLs treated as inline images.
 */
export function extractVideoEmbedsFromNote(
  content: string,
  tags: string[][]
): NostrVideoEmbed[] {
  const urls = collectHttpUrlsFromNote(content, tags)
  const out: NostrVideoEmbed[] = []
  const seenWatch = new Set<string>()

  for (const u of urls) {
    if (isPlausibleImageHttpUrl(u)) {
      continue
    }
    const embed = parseVideoEmbedFromUrl(u)
    if (!embed) {
      continue
    }
    if (seenWatch.has(embed.watchUrl)) {
      continue
    }
    seenWatch.add(embed.watchUrl)
    out.push(embed)
  }

  return out
}
