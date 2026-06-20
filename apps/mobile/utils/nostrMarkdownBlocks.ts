import {
  type MarkdownBlock,
  type MarkdownInlineSegment,
  type VisibleMarkdownBlock
} from '@/types/models/NostrMarkdown'

const HEADING_RE = /^(#{1,6})\s+(.+)$/
const UL_RE = /^[-*+]\s+(.+)$/
const OL_RE = /^(\d+)[.)]\s*(.+)$/
const QUOTE_RE = /^>\s?(.+)$/
const HR_RE = /^(\*{3,}|-{3,}|_{3,})$/

function trimLineStart(line: string): string {
  return line.trimStart()
}

const INLINE_RE =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)]+\))/g

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmedStart = trimLineStart(line)

    if (line.trim().length === 0) {
      blocks.push({ type: 'spacer' })
      index += 1
      continue
    }

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) {
        index += 1
      }
      blocks.push({ type: 'code', value: codeLines.join('\n') })
      continue
    }

    const headingMatch = trimmedStart.match(HEADING_RE)
    if (headingMatch) {
      blocks.push({
        level: headingMatch[1].length,
        segments: parseInlineSegments(headingMatch[2]),
        type: 'heading'
      })
      index += 1
      continue
    }

    if (HR_RE.test(line.trim())) {
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }

    const quoteMatch = trimmedStart.match(QUOTE_RE)
    if (quoteMatch) {
      blocks.push({
        segments: parseInlineSegments(quoteMatch[1]),
        type: 'quote'
      })
      index += 1
      continue
    }

    const ulMatch = trimmedStart.match(UL_RE)
    if (ulMatch) {
      blocks.push({
        ordered: false,
        segments: parseInlineSegments(ulMatch[1]),
        type: 'list'
      })
      index += 1
      continue
    }

    const olMatch = trimmedStart.match(OL_RE)
    if (olMatch && olMatch[2].trim().length > 0) {
      blocks.push({
        index: Number.parseInt(olMatch[1], 10),
        ordered: true,
        segments: parseInlineSegments(olMatch[2].trim()),
        type: 'list'
      })
      index += 1
      continue
    }

    blocks.push({
      segments: parseInlineSegments(line),
      type: 'paragraph'
    })
    index += 1
  }

  return blocks
}

export function parseInlineSegments(text: string): MarkdownInlineSegment[] {
  const segments: MarkdownInlineSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(INLINE_RE)) {
    const token = match[0]
    const start = match.index ?? 0

    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) })
    }

    if (token.startsWith('`') && token.endsWith('`')) {
      segments.push({ type: 'code', value: token.slice(1, -1) })
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      segments.push({ type: 'bold', value: token.slice(2, -2) })
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      segments.push({ type: 'italic', value: token.slice(1, -1) })
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        segments.push({ label: linkMatch[1], type: 'link', url: linkMatch[2] })
      } else {
        segments.push({ type: 'text', value: token })
      }
    } else {
      segments.push({ type: 'text', value: token })
    }

    lastIndex = start + token.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', value: text })
  }

  return segments
}

export function collapseMarkdownSpacers(
  blocks: MarkdownBlock[]
): VisibleMarkdownBlock[] {
  return blocks.reduce<{
    items: VisibleMarkdownBlock[]
    pendingBreak: boolean
  }>(
    (acc, block) => {
      if (block.type === 'spacer') {
        return { ...acc, pendingBreak: true }
      }

      return {
        items: [...acc.items, { afterBreak: acc.pendingBreak, block }],
        pendingBreak: false
      }
    },
    { items: [], pendingBreak: false }
  ).items
}
