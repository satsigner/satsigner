import { nip19 } from 'nostr-tools'
import { type ReactNode } from 'react'
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'

import SSNoteInlineImages from '@/components/SSNoteInlineImages'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatNostrCardDate } from '@/utils/format'
import { truncateNpub } from '@/utils/nostrIdentity'
import { extractImageUrlsFromNote } from '@/utils/nostrNoteMedia'
import { noteLooksLikeReply } from '@/utils/nostrNoteThread'

export type NostrFeedNoteLike = {
  id: string
  content: string
  pubkey: string
  kind: number
  tags: string[][]
  created_at: number
}

function getDTagFromTags(tags: string[][]): string | undefined {
  const row = tags.find((tag) => tag[0] === 'd')
  return typeof row?.[1] === 'string' ? row[1] : undefined
}

function encodeNotePrimaryNip19(note: NostrFeedNoteLike): string {
  try {
    const d = getDTagFromTags(note.tags)
    if (
      d &&
      note.pubkey &&
      (note.kind === 1063 || (note.kind >= 30000 && note.kind < 40000))
    ) {
      return nip19.naddrEncode({
        identifier: d,
        kind: note.kind,
        pubkey: note.pubkey
      })
    }
    if (note.kind !== 1 && note.pubkey) {
      return nip19.neventEncode({
        author: note.pubkey,
        id: note.id,
        kind: note.kind
      })
    }
    return nip19.noteEncode(note.id)
  } catch {
    return note.id
  }
}

type SSNostrFeedAuthorRowProps = {
  loading: boolean
  npubBech: string
  displayName: string
  nip05: string
  pictureUri?: string
}

function SSNostrFeedAuthorRow({
  loading,
  npubBech,
  displayName,
  nip05,
  pictureUri
}: SSNostrFeedAuthorRowProps) {
  if (loading) {
    return (
      <SSHStack gap="md" style={styles.feedAuthorRow}>
        <View
          style={[styles.feedAuthorAvatar, styles.feedAuthorAvatarSkeleton]}
        />
        <SSVStack gap="xxs" style={styles.feedAuthorTextCol}>
          <View style={styles.skeletonLineLg} />
          <SSText
            size="xxs"
            color="muted"
            type="mono"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {truncateNpub(npubBech, 14)}
          </SSText>
          <View style={styles.skeletonLineMd} />
        </SSVStack>
      </SSHStack>
    )
  }

  return (
    <SSHStack gap="md" style={styles.feedAuthorRow}>
      {pictureUri ? (
        <Image source={{ uri: pictureUri }} style={styles.feedAuthorAvatar} />
      ) : (
        <View
          style={[
            styles.feedAuthorAvatar,
            styles.feedAuthorAvatarPlaceholder
          ]}
        >
          <SSText size="sm" weight="bold">
            {displayName
              ? displayName[0]?.toUpperCase()
              : npubBech.slice(5, 6)?.toUpperCase() || '?'}
          </SSText>
        </View>
      )}
      <SSVStack gap="xxs" style={styles.feedAuthorTextCol}>
        <SSText
          size="sm"
          weight="medium"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayName || '—'}
        </SSText>
        <SSText
          size="xxs"
          color="muted"
          type="mono"
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {truncateNpub(npubBech, 14)}
        </SSText>
        <SSText
          size="xxs"
          color="muted"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {nip05 || '—'}
        </SSText>
      </SSVStack>
    </SSHStack>
  )
}

type SSNostrFeedNoteRowProps = {
  note: NostrFeedNoteLike
  privacyMode: boolean
  showAuthor: boolean
  showNoteNipIds?: boolean
  onPress?: () => void
  /** Full note body (e.g. note detail). When false, `contentNumberOfLines` applies. */
  expandContent?: boolean
  contentNumberOfLines?: number
  authorPreview?: ReactNode
}

function SSNostrFeedNoteRow({
  note,
  privacyMode,
  showAuthor,
  showNoteNipIds = false,
  onPress,
  expandContent = false,
  contentNumberOfLines = 4,
  authorPreview
}: SSNostrFeedNoteRowProps) {
  const imageUrls = privacyMode
    ? []
    : extractImageUrlsFromNote(note.content, note.tags).slice(0, 6)

  const eventNip19 = !privacyMode ? encodeNotePrimaryNip19(note) : ''
  const authorNpub = !privacyMode ? nip19.npubEncode(note.pubkey) : ''
  const showReplyTag = !privacyMode && noteLooksLikeReply(note.tags)
  const hasMetaAbove = !privacyMode && (showAuthor || showNoteNipIds)

  const inner = (
    <>
      {showReplyTag ? (
        <View style={styles.noteReplyTag} pointerEvents="none">
          <SSText
            size="xxs"
            color="white"
            uppercase
            style={styles.noteReplyTagText}
          >
            {t('nostrIdentity.feed.replyTag')}
          </SSText>
        </View>
      ) : null}
      <SSVStack
        gap="xs"
        style={showReplyTag ? styles.noteRowBodyWithReply : undefined}
      >
        {showNoteNipIds && !privacyMode ? (
          <SSVStack gap="xxs" style={styles.noteMetaAboveContent}>
            <SSText
              size="xxs"
              color="muted"
              type="mono"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {truncateNpub(eventNip19, 16)}
            </SSText>
            <SSText
              size="xxs"
              color="muted"
              type="mono"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {truncateNpub(authorNpub, 14)}
            </SSText>
          </SSVStack>
        ) : null}
        {showAuthor && !privacyMode && authorPreview ? authorPreview : null}
        <SSText
          size="sm"
          style={[
            styles.noteContent,
            hasMetaAbove && styles.noteContentAfterMeta
          ]}
          {...(expandContent
            ? {}
            : { numberOfLines: contentNumberOfLines })}
        >
          {privacyMode
            ? t('nostrIdentity.feed.hiddenInPrivacyMode')
            : note.content}
        </SSText>
        {imageUrls.length > 0 ? (
          <SSNoteInlineImages
            uris={imageUrls}
            style={styles.noteInlineImages}
          />
        ) : null}
        <SSText size="xxs" color="muted">
          {formatNostrCardDate(note.created_at)}
        </SSText>
      </SSVStack>
    </>
  )

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.noteRow}
        activeOpacity={0.6}
        onPress={onPress}
      >
        {inner}
      </TouchableOpacity>
    )
  }

  return <View style={styles.noteRow}>{inner}</View>
}

const styles = StyleSheet.create({
  feedAuthorAvatar: {
    borderRadius: 16,
    height: 32,
    width: 32
  },
  feedAuthorAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  feedAuthorAvatarSkeleton: {
    backgroundColor: 'rgba(255,255,255,0.06)'
  },
  feedAuthorRow: {
    alignItems: 'center'
  },
  feedAuthorTextCol: {
    flex: 1,
    minWidth: 0
  },
  noteContent: {
    color: Colors.white,
    fontSize: 14,
    lineHeight: 20
  },
  noteContentAfterMeta: {
    marginTop: 16
  },
  noteInlineImages: {
    marginTop: 4
  },
  noteMetaAboveContent: {
    marginBottom: 4
  },
  noteReplyTag: {
    backgroundColor: Colors.gray[800],
    borderColor: Colors.gray[700],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1
  },
  noteReplyTagText: {
    letterSpacing: 0.5
  },
  noteRow: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingTop: 8,
    position: 'relative'
  },
  noteRowBodyWithReply: {
    paddingRight: 52
  },
  skeletonLineLg: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderRadius: 2,
    height: 9,
    width: '58%'
  },
  skeletonLineMd: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: 2,
    height: 8,
    width: '38%'
  }
})

export { SSNostrFeedAuthorRow, SSNostrFeedNoteRow }
