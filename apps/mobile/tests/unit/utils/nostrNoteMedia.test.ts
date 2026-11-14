import {
  extractImageUrlsFromNote,
  isPlausibleImageHttpUrl
} from '@/utils/nostrNoteMedia'
import { extractVideoEmbedsFromNote } from '@/utils/nostrNoteVideoUrls'

const BLOSSOM_HASH_URL = `https://blossom.example/${'a'.repeat(64)}`

describe('isPlausibleImageHttpUrl', () => {
  it('trusts the declared imeta mime type over the url', () => {
    expect(isPlausibleImageHttpUrl(BLOSSOM_HASH_URL, 'image/webp')).toBe(true)
    expect(isPlausibleImageHttpUrl(BLOSSOM_HASH_URL, 'video/mp4')).toBe(false)
    expect(
      isPlausibleImageHttpUrl('https://cdn.example/photo.jpg', 'video/mp4')
    ).toBe(false)
  })

  it('never treats a video file on an image host as an image', () => {
    expect(isPlausibleImageHttpUrl('https://video.nostr.build/clip.mp4')).toBe(
      false
    )
    expect(
      isPlausibleImageHttpUrl('https://blossom.example/clip.webm?x=1')
    ).toBe(false)
  })

  it('accepts image files and extensionless media from image hosts', () => {
    expect(isPlausibleImageHttpUrl('https://cdn.example/photo.PNG')).toBe(true)
    expect(isPlausibleImageHttpUrl(BLOSSOM_HASH_URL)).toBe(true)
    expect(isPlausibleImageHttpUrl('https://cdn.example/page')).toBe(false)
    expect(isPlausibleImageHttpUrl('ftp://cdn.example/photo.png')).toBe(false)
  })
})

describe('extractImageUrlsFromNote', () => {
  it('leaves a blossom video declared in imeta to the video player', () => {
    const videoUrl = `${BLOSSOM_HASH_URL}.mp4`
    const tags = [['imeta', `url ${videoUrl}`, 'm video/mp4', 'dim 720x1280']]

    expect(extractImageUrlsFromNote(videoUrl, tags)).toStrictEqual([])
    expect(extractVideoEmbedsFromNote(videoUrl, tags)).toStrictEqual([
      expect.objectContaining({ provider: 'direct', watchUrl: videoUrl })
    ])
  })

  it('leaves an extensionless blossom video declared in imeta out', () => {
    const tags = [['imeta', `url ${BLOSSOM_HASH_URL}`, 'm Video/MP4']]

    expect(extractImageUrlsFromNote(BLOSSOM_HASH_URL, tags)).toStrictEqual([])
  })

  it('shows a nostr.build video with no imeta as a video only', () => {
    const videoUrl = 'https://video.nostr.build/clip.mp4'

    expect(extractImageUrlsFromNote(videoUrl, [])).toStrictEqual([])
    expect(extractVideoEmbedsFromNote(videoUrl, [])).toHaveLength(1)
  })

  it('keeps images from imeta and content', () => {
    const tags = [['imeta', `url ${BLOSSOM_HASH_URL}`, 'm image/jpeg']]
    const content = `${BLOSSOM_HASH_URL} https://cdn.example/photo.jpg`

    expect(extractImageUrlsFromNote(content, tags)).toStrictEqual([
      BLOSSOM_HASH_URL,
      'https://cdn.example/photo.jpg'
    ])
  })
})
