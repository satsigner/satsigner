import { extractVideoEmbedsFromNote } from '@/utils/nostrNoteVideoUrls'

describe('extractVideoEmbedsFromNote', () => {
  it('parses youtube.com watch URL', () => {
    const content = 'see https://www.youtube.com/watch?v=dQw4w9WgXcQ cool'
    const r = extractVideoEmbedsFromNote(content, [])
    expect(r).toHaveLength(1)
    expect(r[0].provider).toBe('youtube')
    expect(r[0].watchUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(r[0].thumbnailUrl).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    )
  })

  it('parses youtu.be short URL', () => {
    const content = 'https://youtu.be/dQw4w9WgXcQ'
    const r = extractVideoEmbedsFromNote(content, [])
    expect(r[0].provider).toBe('youtube')
    expect(r[0].watchUrl).toContain('dQw4w9WgXcQ')
  })

  it('parses vimeo URL', () => {
    const content = 'https://vimeo.com/148751763'
    const r = extractVideoEmbedsFromNote(content, [])
    expect(r).toHaveLength(1)
    expect(r[0].provider).toBe('vimeo')
    expect(r[0].watchUrl).toBe('https://vimeo.com/148751763')
    expect(r[0].thumbnailUrl).toBeUndefined()
  })

  it('parses twitch vod', () => {
    const content = 'https://www.twitch.tv/videos/1234567890'
    const r = extractVideoEmbedsFromNote(content, [])
    expect(r).toHaveLength(1)
    expect(r[0].provider).toBe('twitch_vod')
    expect(r[0].watchUrl).toContain('twitch.tv/videos/1234567890')
  })

  it('parses direct mp4 URL', () => {
    const content = 'https://example.com/a/file.mp4'
    const r = extractVideoEmbedsFromNote(content, [])
    expect(r).toHaveLength(1)
    expect(r[0].provider).toBe('direct')
    expect(r[0].watchUrl).toBe('https://example.com/a/file.mp4')
  })

  it('skips image URLs', () => {
    const content = 'https://example.com/x.png https://youtu.be/dQw4w9WgXcQ'
    const r = extractVideoEmbedsFromNote(content, [])
    expect(r).toHaveLength(1)
    expect(r[0].provider).toBe('youtube')
  })

  it('dedupes same watch URL', () => {
    const content =
      'https://youtu.be/dQw4w9WgXcQ and https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const r = extractVideoEmbedsFromNote(content, [])
    expect(r).toHaveLength(1)
  })

  it('reads video URL from imeta tag', () => {
    const tags: string[][] = [
      ['imeta', 'url https://youtu.be/dQw4w9WgXcQ', 'm video/mp4']
    ]
    const r = extractVideoEmbedsFromNote('', tags)
    expect(r).toHaveLength(1)
    expect(r[0].provider).toBe('youtube')
  })
})
