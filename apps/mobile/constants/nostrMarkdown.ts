export const NOSTR_MARKDOWN_BODY_LINE_HEIGHT = 23

export const NOSTR_MARKDOWN_PARAGRAPH_BREAK_MARGIN = 14

export const NOSTR_MARKDOWN_LIST_MARKER_MIN_WIDTH = 30
export const NOSTR_MARKDOWN_LIST_MARKER_CHAR_WIDTH = 10
export const NOSTR_MARKDOWN_LIST_MARKER_PADDING = 10

export const NOSTR_MARKDOWN_HEADING_MARGIN = {
  h1: { bottom: 6, top: 56 },
  h2: { bottom: 4, top: 44 },
  h3: { bottom: 3, top: 36 },
  h4: { bottom: 2, top: 28 }
} as const

export const NOSTR_MARKDOWN_HEADING_LINE_HEIGHT = {
  h1: 28,
  h2: 26,
  h3: 24,
  h4: 22
} as const

export const NOSTR_LONG_FORM_NOTE_KIND = {
  CONTENT: 30023,
  DRAFT: 30024
} as const
