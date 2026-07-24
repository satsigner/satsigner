import {
  collapseMarkdownSpacers,
  isSafeHttpUrl,
  parseInlineSegments,
  parseMarkdownBlocks
} from '@/utils/markdown'

describe('parseMarkdownBlocks', () => {
  it('parses headings, lists, and code blocks', () => {
    const blocks = parseMarkdownBlocks(
      '# Title\n\nHello **world**\n\n- one\n- two\n\n```\ncode\n```'
    )

    expect(blocks[0]).toStrictEqual({
      level: 1,
      segments: [{ type: 'text', value: 'Title' }],
      type: 'heading'
    })
    expect(blocks[2]).toStrictEqual({
      segments: [
        { type: 'text', value: 'Hello ' },
        { type: 'bold', value: 'world' }
      ],
      type: 'paragraph'
    })
    expect(blocks[4]).toStrictEqual({
      ordered: false,
      segments: [{ type: 'text', value: 'one' }],
      type: 'list'
    })
    expect(blocks[7]).toStrictEqual({
      type: 'code',
      value: 'code'
    })
  })

  it('parses ordered lists with or without space after the marker', () => {
    const blocks = parseMarkdownBlocks(
      '4. Lorem ipsum\n4)Lorem ipsum\n  10. Ten'
    )

    expect(blocks[0]).toStrictEqual({
      index: 4,
      ordered: true,
      segments: [{ type: 'text', value: 'Lorem ipsum' }],
      type: 'list'
    })
    expect(blocks[1]).toStrictEqual({
      index: 4,
      ordered: true,
      segments: [{ type: 'text', value: 'Lorem ipsum' }],
      type: 'list'
    })
    expect(blocks[2]).toStrictEqual({
      index: 10,
      ordered: true,
      segments: [{ type: 'text', value: 'Ten' }],
      type: 'list'
    })
  })
})

describe('collapseMarkdownSpacers', () => {
  it('marks blocks after blank lines', () => {
    const blocks = parseMarkdownBlocks('One\n\nTwo')
    expect(collapseMarkdownSpacers(blocks)).toStrictEqual([
      {
        afterBreak: false,
        block: {
          segments: [{ type: 'text', value: 'One' }],
          type: 'paragraph'
        }
      },
      {
        afterBreak: true,
        block: {
          segments: [{ type: 'text', value: 'Two' }],
          type: 'paragraph'
        }
      }
    ])
  })
})

describe('parseInlineSegments', () => {
  it('parses links and inline code', () => {
    expect(
      parseInlineSegments('See [docs](https://example.com) and `code`')
    ).toStrictEqual([
      { type: 'text', value: 'See ' },
      { label: 'docs', type: 'link', url: 'https://example.com' },
      { type: 'text', value: ' and ' },
      { type: 'code', value: 'code' }
    ])
  })

  it('renders non-http(s) link schemes as plain text', () => {
    expect(
      parseInlineSegments('Tap [wallet](bitcoin:bc1qxy) now')
    ).toStrictEqual([
      { type: 'text', value: 'Tap ' },
      { type: 'text', value: '[wallet](bitcoin:bc1qxy)' },
      { type: 'text', value: ' now' }
    ])
  })
})

describe('isSafeHttpUrl', () => {
  it('allows http and https only', () => {
    expect(isSafeHttpUrl('https://example.com')).toBe(true)
    expect(isSafeHttpUrl('http://example.com/path')).toBe(true)
    expect(isSafeHttpUrl('bitcoin:bc1qxy')).toBe(false)
    expect(isSafeHttpUrl('tel:+15551212')).toBe(false)
    expect(isSafeHttpUrl(['javascript', 'alert(1)'].join(':'))).toBe(false)
    expect(isSafeHttpUrl('not a url')).toBe(false)
  })
})
