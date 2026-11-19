import type { ComponentProps } from 'react'
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSPressable from '@/components/SSPressable'
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
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { TextFontSize, TextFontWeight } from '@/styles/sizes'
import type {
  MarkdownBlock,
  MarkdownInlineSegment
} from '@/types/models/NostrMarkdown'
import { setClipboard } from '@/utils/clipboard'
import {
  collapseMarkdownSpacers,
  isSafeHttpUrl,
  parseMarkdownBlocks
} from '@/utils/markdown'

type SSMarkdownProps = {
  content: string
  /** Ask before opening a link, showing its full URL (untrusted content such as DMs). */
  confirmLinks?: boolean
}

type InlineSegmentsProps = {
  segments: MarkdownInlineSegment[]
  size?: TextFontSize
  weight?: TextFontWeight
  color?: 'white' | 'black' | 'muted'
  style?: ComponentProps<typeof SSText>['style']
}

type InlineFormat = Required<
  Pick<InlineSegmentsProps, 'color' | 'size' | 'weight'>
> &
  Pick<InlineSegmentsProps, 'style'> & { confirmLinks: boolean }

type HeadingStyle = {
  size: TextFontSize
  weight: TextFontWeight
  color?: 'white' | 'black' | 'muted'
  style: ComponentProps<typeof SSText>['style']
}

const BODY_SIZE: TextFontSize = 'md'
const BOLD_WEIGHT: TextFontWeight = 'medium'
const CODE_COPY_HIT_SLOP = 8
const CODE_COPY_PRESSED_OPACITY = 0.6

async function openLink(url: string) {
  if (!isSafeHttpUrl(url)) {
    return
  }
  try {
    await Linking.openURL(url)
  } catch {
    toast.error(t('common.openLinkFailed'))
  }
}

function confirmOpenLink(url: string) {
  if (!isSafeHttpUrl(url)) {
    return
  }
  Alert.alert(t('nostrIdentity.chat.openLinkTitle'), url, [
    { style: 'cancel', text: t('common.cancel') },
    { onPress: () => void openLink(url), text: t('common.open') }
  ])
}

async function copyCode(code: string) {
  const copied = await setClipboard(code)
  if (copied) {
    toast.success(t('common.copiedToClipboard'))
    return
  }
  toast.error(t('common.copyFailed'))
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
  confirm,
  label,
  size,
  style,
  url
}: {
  confirm: boolean
  label: string
  size: TextFontSize
  style?: ComponentProps<typeof SSText>['style']
  url: string
}) {
  function handlePress() {
    if (confirm) {
      confirmOpenLink(url)
      return
    }
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

function InlineSegment({
  format,
  segment
}: {
  format: InlineFormat
  segment: MarkdownInlineSegment
}) {
  if (segment.type === 'bold') {
    return (
      <InlineSegmentGroup
        format={{ ...format, weight: BOLD_WEIGHT }}
        segments={segment.segments}
      />
    )
  }
  if (segment.type === 'italic') {
    return (
      <InlineSegmentGroup format={format} italic segments={segment.segments} />
    )
  }
  if (segment.type === 'code') {
    return (
      <SSText
        size="xs"
        type="mono"
        style={[styles.body, styles.inlineCode, format.style]}
      >
        {segment.value}
      </SSText>
    )
  }
  if (segment.type === 'link') {
    return (
      <MarkdownLinkSegment
        confirm={format.confirmLinks}
        label={segment.label}
        size={format.size}
        style={format.style}
        url={segment.url}
      />
    )
  }
  return segment.value
}

function InlineSegmentGroup({
  format,
  italic = false,
  segments
}: {
  format: InlineFormat
  italic?: boolean
  segments: MarkdownInlineSegment[]
}) {
  return (
    <SSText
      size={format.size}
      weight={format.weight}
      color={format.color}
      style={[styles.body, italic && styles.italic, format.style]}
    >
      {segments.map((segment, index) => (
        <InlineSegment
          key={`${segment.type}-${index}`}
          format={format}
          segment={segment}
        />
      ))}
    </SSText>
  )
}

function InlineSegments({
  segments,
  confirmLinks,
  size = BODY_SIZE,
  weight = 'regular',
  color = 'white',
  style
}: InlineSegmentsProps & { confirmLinks: boolean }) {
  return (
    <InlineSegmentGroup
      format={{ color, confirmLinks, size, style, weight }}
      segments={segments}
    />
  )
}

function MarkdownCodeBlock({
  code,
  language,
  style
}: {
  code: string
  language?: string
  style: ComponentProps<typeof View>['style']
}) {
  function handleCopy() {
    void copyCode(code)
  }

  return (
    <View style={[styles.codeBlock, style]}>
      <SSHStack style={styles.codeHeader}>
        <SSText size="xxs" color="muted" type="mono">
          {language ?? ''}
        </SSText>
        <SSPressable
          accessibilityLabel={t('common.copyToClipboard')}
          accessibilityRole="button"
          activeOpacity={CODE_COPY_PRESSED_OPACITY}
          hitSlop={CODE_COPY_HIT_SLOP}
          onPress={handleCopy}
        >
          <SSText size="xxs" color="muted" uppercase>
            {t('common.copy')}
          </SSText>
        </SSPressable>
      </SSHStack>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <SSText type="mono" size="xs" style={styles.codeBlockText}>
          {code}
        </SSText>
      </ScrollView>
    </View>
  )
}

function MarkdownBlockView({
  afterBreak,
  block,
  confirmLinks,
  isFirst
}: {
  afterBreak: boolean
  block: MarkdownBlock
  confirmLinks: boolean
  isFirst: boolean
}) {
  const breakStyle = afterBreak ? styles.afterBreak : undefined
  const firstBlockStyle = isFirst ? styles.firstBlock : undefined

  if (block.type === 'hr') {
    return <View style={[styles.hr, breakStyle, firstBlockStyle]} />
  }

  if (block.type === 'code') {
    return (
      <MarkdownCodeBlock
        code={block.value}
        language={block.language}
        style={[breakStyle, firstBlockStyle]}
      />
    )
  }

  if (block.type === 'heading') {
    const heading = getHeadingStyle(block.level)
    return (
      <InlineSegments
        segments={block.segments}
        confirmLinks={confirmLinks}
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
          confirmLinks={confirmLinks}
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
          <InlineSegments
            segments={block.segments}
            confirmLinks={confirmLinks}
          />
        </View>
      </View>
    )
  }

  if (block.type === 'spacer') {
    return null
  }

  return (
    <View style={[styles.paragraph, breakStyle, firstBlockStyle]}>
      <InlineSegments segments={block.segments} confirmLinks={confirmLinks} />
    </View>
  )
}

function SSMarkdown({ content, confirmLinks = false }: SSMarkdownProps) {
  const visibleBlocks = collapseMarkdownSpacers(parseMarkdownBlocks(content))

  return (
    <SSVStack gap="none" style={styles.container}>
      {visibleBlocks.map(({ afterBreak, block }, index) => (
        <MarkdownBlockView
          key={`${block.type}-${index}`}
          afterBreak={afterBreak}
          block={block}
          confirmLinks={confirmLinks}
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
  codeHeader: {
    justifyContent: 'space-between',
    marginBottom: 6
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

export default SSMarkdown
