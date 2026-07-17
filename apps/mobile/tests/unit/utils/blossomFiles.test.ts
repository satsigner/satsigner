import {
  buildBlossomFileDetailItems,
  deduplicateBlossomFilesBySha256,
  filterBlossomFilesByType,
  findBlossomFileBySha256,
  formatBlossomFileSize,
  getAvailableBlossomFileFilters,
  getBlossomFileDisplayName,
  getBlossomFileExtension,
  isBlossomImageMime,
  mimeToFileCategory
} from '@/utils/blossomFiles'

jest.mock<typeof import('@/locales')>('@/locales', () => ({
  t: (key: string) => key
}))

describe('formatBlossomFileSize', () => {
  it('formats bytes and kilobytes', () => {
    expect(formatBlossomFileSize(512)).toBe('512 B')
    expect(formatBlossomFileSize(2048)).toBe('2 KB')
  })
})

describe('mimeToFileCategory', () => {
  it('maps common mime types', () => {
    expect(mimeToFileCategory('image/png')).toBe('image')
    expect(mimeToFileCategory('video/mp4')).toBe('video')
    expect(mimeToFileCategory('application/pdf')).toBe('document')
    expect(mimeToFileCategory(undefined)).toBe('other')
  })
})

describe('getBlossomFileDisplayName', () => {
  it('prefers explicit name', () => {
    expect(
      getBlossomFileDisplayName({
        name: 'avatar.png',
        sha256: 'abc',
        size: 1,
        uploaded: 0,
        url: 'https://example.com/blob'
      })
    ).toBe('avatar.png')
  })

  it('falls back to url segment', () => {
    expect(
      getBlossomFileDisplayName({
        sha256: 'abc',
        size: 1,
        uploaded: 0,
        url: 'https://example.com/photo.jpg'
      })
    ).toBe('photo.jpg')
  })
})

describe('getBlossomFileExtension', () => {
  it('returns uppercase extension', () => {
    expect(
      getBlossomFileExtension({
        name: 'notes.PDF',
        sha256: 'abc',
        size: 1,
        uploaded: 0,
        url: 'https://example.com/blob'
      })
    ).toBe('PDF')
  })
})

describe('deduplicateBlossomFilesBySha256', () => {
  it('keeps first blob per hash', () => {
    const blobs = deduplicateBlossomFilesBySha256([
      {
        name: 'first',
        sha256: 'hash-a',
        size: 1,
        uploaded: 1,
        url: 'https://a.example'
      },
      {
        name: 'duplicate',
        sha256: 'hash-a',
        size: 2,
        uploaded: 2,
        url: 'https://b.example'
      }
    ])

    expect(blobs).toHaveLength(1)
    expect(blobs[0].name).toBe('first')
  })
})

describe('getAvailableBlossomFileFilters', () => {
  it('returns all plus categories present in files', () => {
    const filters = getAvailableBlossomFileFilters([
      {
        sha256: 'a',
        size: 1,
        type: 'image/png',
        uploaded: 1,
        url: 'https://a.example'
      },
      {
        sha256: 'b',
        size: 1,
        type: 'video/mp4',
        uploaded: 1,
        url: 'https://b.example'
      }
    ])

    expect(filters).toStrictEqual(['all', 'image', 'video'])
  })
})

describe('filterBlossomFilesByType', () => {
  it('filters by category', () => {
    const files = [
      {
        sha256: 'a',
        size: 1,
        type: 'image/png',
        uploaded: 1,
        url: 'https://a.example'
      },
      {
        sha256: 'b',
        size: 1,
        type: 'video/mp4',
        uploaded: 1,
        url: 'https://b.example'
      }
    ]

    expect(filterBlossomFilesByType(files, 'image')).toHaveLength(1)
    expect(filterBlossomFilesByType(files, 'all')).toHaveLength(2)
  })
})

describe('findBlossomFileBySha256', () => {
  it('finds matching file', () => {
    const file = {
      name: 'avatar.png',
      sha256: 'hash-a',
      size: 1,
      uploaded: 1,
      url: 'https://a.example'
    }

    expect(findBlossomFileBySha256([file], 'hash-a')).toBe(file)
  })
})

describe('isBlossomImageMime', () => {
  it('detects image mime types', () => {
    expect(isBlossomImageMime('image/png')).toBe(true)
    expect(isBlossomImageMime('video/mp4')).toBe(false)
  })
})

describe('buildBlossomFileDetailItems', () => {
  it('includes core metadata fields', () => {
    const items = buildBlossomFileDetailItems({
      name: 'avatar.png',
      sha256: 'hash-a',
      size: 2048,
      type: 'image/png',
      uploaded: 1_700_000_000,
      url: 'https://a.example/avatar.png'
    })

    expect(items).toHaveLength(8)
    expect(items[0][0]).toBe('nostrIdentity.files.detail.name')
    expect(items[7][0]).toBe('nostrIdentity.files.detail.url')
  })
})
