export type MarkdownInlineSegment =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; url: string }

export type MarkdownBlock =
  | { type: 'heading'; level: number; segments: MarkdownInlineSegment[] }
  | { type: 'paragraph'; segments: MarkdownInlineSegment[] }
  | { type: 'code'; value: string }
  | {
      type: 'list'
      ordered: boolean
      index?: number
      segments: MarkdownInlineSegment[]
    }
  | { type: 'quote'; segments: MarkdownInlineSegment[] }
  | { type: 'hr' }
  | { type: 'spacer' }

export type VisibleMarkdownBlock = {
  afterBreak: boolean
  block: MarkdownBlock
}
