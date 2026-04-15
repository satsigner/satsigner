import { ActivityIndicator, Image, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import {
  type DecodedNostrContent,
  extractPubpayTags,
  truncateNpub
} from '@/utils/nostrIdentity'

type SSNostrNoteTemplateProps = {
  content: DecodedNostrContent
  onPay?: (amountSats: number) => void
}

function PubpayRows({
  tags,
  onPay
}: {
  tags: string[][]
  onPay?: (amountSats: number) => void
}) {
  const pubpayTags = extractPubpayTags(tags)
  if (pubpayTags.length === 0) return null

  return (
    <>
      {pubpayTags.map((tag, index) => (
        <SSHStack key={index} gap="sm" style={styles.payRow}>
          <SSVStack gap="none" style={{ flex: 1 }}>
            <SSText size="sm">
              {tag.amount} {tag.currency}
            </SSText>
          </SSVStack>
          <SSButton
            label="Pay"
            variant="gradient"
            gradientType="special"
            onPress={() => onPay?.(tag.amount)}
            style={styles.payButton}
          />
        </SSHStack>
      ))}
    </>
  )
}

function AuthorRow({
  name,
  picture,
  pubkey
}: {
  name?: string
  picture?: string
  pubkey?: string
}) {
  if (!name && !pubkey) return null

  return (
    <SSHStack gap="sm" style={styles.authorRow}>
      {picture ? (
        <Image source={{ uri: picture }} style={styles.authorAvatar} />
      ) : (
        <View style={[styles.authorAvatar, styles.authorAvatarPlaceholder]}>
          <SSText size="xs" weight="bold">
            {name?.[0]?.toUpperCase() || '?'}
          </SSText>
        </View>
      )}
      <SSVStack gap="none" style={{ flex: 1 }}>
        {name && <SSText size="sm">{name}</SSText>}
        {pubkey && (
          <SSText size="xs" color="muted" type="mono">
            {truncateNpub(pubkey, 10)}
          </SSText>
        )}
      </SSVStack>
    </SSHStack>
  )
}

function formatTimestamp(ts: number): string {
  if (!ts) return ''
  const date = new Date(ts * 1000)
  return date.toLocaleString()
}

function SSNostrNoteTemplate({ content, onPay }: SSNostrNoteTemplateProps) {
  const tags =
    content.metadata && Array.isArray(content.metadata.tags)
      ? (content.metadata.tags as string[][])
      : []

  if (content.kind === 'npub' || content.kind === 'nprofile') {
    return (
      <SSVStack gap="sm" style={styles.container}>
        <SSText size="xs" color="muted" uppercase>
          Profile
        </SSText>
        <SSText type="mono" size="sm">
          {truncateNpub(content.raw, 16)}
        </SSText>
      </SSVStack>
    )
  }

  if (content.kind === 'note' || content.kind === 'nevent') {
    if (content.isLoading) {
      return (
        <SSVStack gap="sm" itemsCenter style={styles.container}>
          <ActivityIndicator color={Colors.white} />
          <SSText size="xs" color="muted">
            {t('nostrIdentity.account.fetchingNote')}
          </SSText>
        </SSVStack>
      )
    }

    if (content.fetched) {
      const { fetched } = content
      return (
        <SSVStack gap="sm" style={styles.container}>
          <SSHStack gap="sm">
            <SSText size="xs" color="muted" uppercase>
              Note
            </SSText>
            <View style={styles.kindBadge}>
              <SSText size="xs">Kind {fetched.kind}</SSText>
            </View>
            {fetched.created_at > 0 && (
              <SSText size="xs" color="muted">
                {formatTimestamp(fetched.created_at)}
              </SSText>
            )}
          </SSHStack>
          <AuthorRow
            name={fetched.authorName}
            picture={fetched.authorPicture}
            pubkey={fetched.pubkey}
          />
          {fetched.content.length > 0 && (
            <SSText size="sm" style={styles.noteContent} numberOfLines={10}>
              {fetched.content}
            </SSText>
          )}
          <SSText type="mono" size="xs" color="muted">
            {truncateNpub(content.raw, 12)}
          </SSText>
          <PubpayRows tags={fetched.tags} onPay={onPay} />
        </SSVStack>
      )
    }

    return (
      <SSVStack gap="sm" style={styles.container}>
        <SSText size="xs" color="muted" uppercase>
          Note
        </SSText>
        <SSText type="mono" size="xs" color="muted">
          {truncateNpub(content.raw, 16)}
        </SSText>
        <PubpayRows tags={tags} onPay={onPay} />
      </SSVStack>
    )
  }

  if (content.kind === 'json_note') {
    const noteContent =
      typeof content.metadata?.content === 'string'
        ? content.metadata.content
        : ''
    const noteKind =
      typeof content.metadata?.kind === 'number'
        ? content.metadata.kind
        : undefined

    return (
      <SSVStack gap="sm" style={styles.container}>
        <SSHStack gap="sm">
          <SSText size="xs" color="muted" uppercase>
            JSON Note
          </SSText>
          {noteKind !== undefined && (
            <View style={styles.kindBadge}>
              <SSText size="xs">Kind {noteKind}</SSText>
            </View>
          )}
        </SSHStack>
        {noteContent.length > 0 && (
          <SSText size="sm" style={styles.noteContent} numberOfLines={6}>
            {noteContent}
          </SSText>
        )}
        <PubpayRows tags={tags} onPay={onPay} />
      </SSVStack>
    )
  }

  return (
    <SSVStack gap="sm" style={styles.container}>
      <SSText size="xs" color="muted" uppercase>
        Unknown Content
      </SSText>
      <SSText size="sm" color="muted" numberOfLines={4}>
        {content.raw}
      </SSText>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  authorAvatar: {
    borderRadius: 14,
    height: 28,
    width: 28
  },
  authorAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  authorRow: {
    alignItems: 'center'
  },
  container: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  kindBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  noteContent: {
    color: Colors.white,
    lineHeight: 20
  },
  payButton: {
    minWidth: 80
  },
  payRow: {
    borderColor: Colors.gray[800],
    borderTopWidth: 1,
    paddingTop: 8
  }
})

export default SSNostrNoteTemplate
