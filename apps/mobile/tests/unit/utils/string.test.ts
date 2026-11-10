import { isNonEmptyString, toSingleLinePreview } from '@/utils/string'

describe('isNonEmptyString', () => {
  it('accepts text and rejects empty values', () => {
    expect(isNonEmptyString('a')).toBe(true)
    expect(isNonEmptyString('')).toBe(false)
    expect(isNonEmptyString(null)).toBe(false)
    expect(isNonEmptyString(undefined)).toBe(false)
  })
})

describe('toSingleLinePreview', () => {
  it('collapses whitespace onto one line', () => {
    expect(toSingleLinePreview('  a\n\n b  ', 10)).toBe('a b')
  })

  it('keeps text that fits', () => {
    expect(toSingleLinePreview('abc', 3)).toBe('abc')
  })

  it('cuts longer text with an ellipsis', () => {
    expect(toSingleLinePreview('abcdef', 3)).toBe('abc…')
  })
})
