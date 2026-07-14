import { type ComponentProps } from 'react'
import { Linking, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import {
  NOSTR_MARKDOWN_BODY_LINE_HEIGHT,
  NOSTR_MARKDOWN_HEADING_LINE_HEIGHT,
  NOSTR_MARKDOWN_HEADING_MARGIN,
  NOSTR_MARKDOWN_LIST_MARKER_CHAR_WIDTH,
  NOSTR_MARKDOWN_LIST_MARKER_MIN_WIDTH,
  NOSTR_MARKDOWN_LIST_MARKER_PADDING,
  NOSTR_MARKDOWN_PARAGRAPH_BREAK_MARGIN
} from '@/constants/nostrMarkdown'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type TextFontSize, type TextFontWeight } from '@/styles/sizes'
import {
  type MarkdownBlock,
  type MarkdownInlineSegment
} from '@/types/models/NostrMarkdown'
import {
  collapseMarkdownSpacers,
  parseMarkdownBlocks
} from '@/utils/nostrMarkdownBlocks'

type SSNostrMarkdownContentProps = {
  content: string
}

type InlineSegmentsProps = {
  segments: MarkdownInlineSegment[]
  size?: TextFontSize
  weight?: TextFontWeight
  color?: 'white' | 'black' | 'muted'
  style?: ComponentProps<typeof SSText>['style']
}

type HeadingStyle = {
  size: TextFontSize
  weight: TextFontWeight
  color?: 'white' | 'black' | 'muted'
  style: ComponentProps<typeof SSText>['style']
}

const BODY_SIZE: TextFontSize = 'md'

async function openLink(url: string) {
  try {
    await Linking.openURL(url)
  } catch {
    // Ignore invalid or unsupported links.
  }
}

function getOrderedListMarker(index: number): string {
  return `${index}.`
}

function getListMarkerMinWidth(marker: string): number {
  return Math.max(
    NOSTR_MARKDOWN_LIST_MARKER_MIN_WIDTH,
    marker.length * NOSTR_MARKDOWN_LIST_MARKER_CHAR_WIDTH +
      NOSTR_MARKDOWN_LIST_MARKER_PADDING
  )
}

function getHeadingStyle(level: number): HeadingStyle {
  if (level <= 1) {
    return { size: '2xl', style: styles.h1, weight: 'medium' }
  }
  if (level === 2) {
    return { size: 'xl', style: styles.h2, weight: 'medium' }
  }
  if (level === 3) {
    return { size: 'lg', style: styles.h3, weight: 'medium' }
  }
  return {
    color: 'muted',
    size: 'md',
    style: styles.h4,
    weight: 'medium'
  }
}

function MarkdownLinkSegment({
  label,
  size,
  style,
  url
}: {
  label: string
  size: TextFontSize
  style?: ComponentProps<typeof SSText>['style']
  url: string
}) {
  function handlePress() {
    void openLink(url)
  }

  return (
    <SSText
      size={size}
      weight="medium"
      style={[styles.body, styles.link, style]}
      onPress={handlePress}
    >
      {label}
    </SSText>
  )
}

function InlineSegments({
  segments,
  size = BODY_SIZE,
  weight = 'regular',
  color = 'white',
  style
}: InlineSegmentsProps) {
  return (
    <SSText
      size={size}
      weight={weight}
      color={color}
      style={[styles.body, style]}
    >
      {segments.map((segment, index) => {
        const key = `${segment.type}-${index}`
        if (segment.type === 'bold') {
          return (
            <SSText
              key={key}
              size={size}
              weight="medium"
              color={color}
              style={[styles.body, style]}
            >
              {segment.value}
            </SSText>
          )
        }
        if (segment.type === 'italic') {
          return (
            <SSText
              key={key}
              size={size}
              color={color}
              style={[styles.body, styles.italic, style]}
            >
              {segment.value}
            </SSText>
          )
        }
        if (segment.type === 'code') {
          return (
            <SSText
              key={key}
              size="xs"
              type="mono"
              style={[styles.body, styles.inlineCode, style]}
            >
              {segment.value}
            </SSText>
          )
        }
        if (segment.type === 'link') {
          return (
            <MarkdownLinkSegment
              key={key}
              label={segment.label}
              size={size}
              style={style}
              url={segment.url}
            />
          )
        }
        return segment.value
      })}
    </SSText>
  )
}

function MarkdownBlockView({
  afterBreak,
  block,
  isFirst
}: {
  afterBreak: boolean
  block: MarkdownBlock
  isFirst: boolean
}) {
  const breakStyle = afterBreak ? styles.afterBreak : undefined
  const firstBlockStyle = isFirst ? styles.firstBlock : undefined

  if (block.type === 'hr') {
    return <View style={[styles.hr, breakStyle, firstBlockStyle]} />
  }

  if (block.type === 'code') {
    return (
      <View style={[styles.codeBlock, breakStyle, firstBlockStyle]}>
        <SSText type="mono" size="xs" style={styles.codeBlockText}>
          {block.value}
        </SSText>
      </View>
    )
  }

  if (block.type === 'heading') {
    const heading = getHeadingStyle(block.level)
    return (
      <InlineSegments
        segments={block.segments}
        size={heading.size}
        weight={heading.weight}
        color={heading.color}
        style={[
          breakStyle,
          heading.style,
          isFirst ? styles.headingFirst : undefined
        ]}
      />
    )
  }

  if (block.type === 'quote') {
    return (
      <View style={[styles.quote, breakStyle, firstBlockStyle]}>
        <InlineSegments
          segments={block.segments}
          color="muted"
          style={styles.quoteText}
        />
      </View>
    )
  }

  if (block.type === 'list') {
    const marker = block.ordered ? getOrderedListMarker(block.index ?? 1) : '•'
    return (
      <View style={[styles.listRow, breakStyle, firstBlockStyle]}>
        <SSText
          size="xs"
          color="muted"
          type="mono"
          style={[
            styles.listMarker,
            { minWidth: getListMarkerMinWidth(marker) }
          ]}
        >
          {marker}
        </SSText>
        <View style={styles.listContent}>
          <InlineSegments segments={block.segments} />
        </View>
      </View>
    )
  }

  if (block.type === 'spacer') {
    return null
  }

  return (
    <View style={[styles.paragraph, breakStyle, firstBlockStyle]}>
      <InlineSegments segments={block.segments} />
    </View>
  )
}

function SSNostrMarkdownContent({ content }: SSNostrMarkdownContentProps) {
  const visibleBlocks = collapseMarkdownSpacers(parseMarkdownBlocks(content))

  return (
    <SSVStack gap="none" style={styles.container}>
      {visibleBlocks.map(({ afterBreak, block }, index) => (
        <MarkdownBlockView
          key={`${block.type}-${index}`}
          afterBreak={afterBreak}
          block={block}
          isFirst={index === 0}
        />
      ))}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  afterBreak: {
    marginTop: NOSTR_MARKDOWN_PARAGRAPH_BREAK_MARGIN
  },
  body: {
    lineHeight: NOSTR_MARKDOWN_BODY_LINE_HEIGHT
  },
  codeBlock: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  codeBlockText: {
    lineHeight: 20
  },
  container: {
    width: '100%'
  },
  firstBlock: {
    marginTop: 0
  },
  h1: {
    letterSpacing: 0.2,
    lineHeight: NOSTR_MARKDOWN_HEADING_LINE_HEIGHT.h1,
    marginBottom: NOSTR_MARKDOWN_HEADING_MARGIN.h1.bottom,
    marginTop: NOSTR_MARKDOWN_HEADING_MARGIN.h1.top
  },
  h2: {
    letterSpacing: 0.15,
    lineHeight: NOSTR_MARKDOWN_HEADING_LINE_HEIGHT.h2,
    marginBottom: NOSTR_MARKDOWN_HEADING_MARGIN.h2.bottom,
    marginTop: NOSTR_MARKDOWN_HEADING_MARGIN.h2.top
  },
  h3: {
    letterSpacing: 0.1,
    lineHeight: NOSTR_MARKDOWN_HEADING_LINE_HEIGHT.h3,
    marginBottom: NOSTR_MARKDOWN_HEADING_MARGIN.h3.bottom,
    marginTop: NOSTR_MARKDOWN_HEADING_MARGIN.h3.top
  },
  h4: {
    letterSpacing: 0.1,
    lineHeight: NOSTR_MARKDOWN_HEADING_LINE_HEIGHT.h4,
    marginBottom: NOSTR_MARKDOWN_HEADING_MARGIN.h4.bottom,
    marginTop: NOSTR_MARKDOWN_HEADING_MARGIN.h4.top
  },
  headingFirst: {
    marginTop: 0
  },
  hr: {
    backgroundColor: Colors.gray[800],
    height: 1,
    marginBottom: 4,
    marginTop: 6,
    width: '100%'
  },
  inlineCode: {
    backgroundColor: Colors.gray[900],
    borderRadius: 3,
    color: Colors.gray[50],
    lineHeight: 20,
    paddingHorizontal: 5,
    paddingVertical: 1
  },
  italic: {
    fontStyle: 'italic'
  },
  link: {
    color: Colors.gray[75],
    textDecorationLine: 'underline'
  },
  listContent: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1
  },
  listMarker: {
    lineHeight: NOSTR_MARKDOWN_BODY_LINE_HEIGHT,
    paddingRight: 10,
    paddingTop: 1,
    textAlign: 'right'
  },
  listRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginTop: 2,
    width: '100%'
  },
  paragraph: {
    marginTop: 1
  },
  quote: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[700],
    borderLeftWidth: 2,
    borderRadius: 3,
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  quoteText: {
    lineHeight: 22
  }
})

export default SSNostrMarkdownContent
