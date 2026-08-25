import { assertSafePathSegment, sanitizeFilenamePart } from '@/utils/safePath'

describe('assertSafePathSegment', () => {
  it('accepts uuid-like ids', () => {
    expect(assertSafePathSegment('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    )
  })

  it('rejects path traversal', () => {
    expect(() => assertSafePathSegment('../secrets')).toThrow(/Invalid/)
    expect(() => assertSafePathSegment('foo/bar')).toThrow(/Invalid/)
    expect(() => assertSafePathSegment('..')).toThrow(/Invalid/)
  })
})

describe('sanitizeFilenamePart', () => {
  it('strips unsafe characters', () => {
    expect(sanitizeFilenamePart('../../evil name')).toBe('.._.._evil_name')
  })

  it('falls back for empty names', () => {
    expect(sanitizeFilenamePart('   ')).toBe('export')
  })
})
