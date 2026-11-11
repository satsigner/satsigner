import { Image, Pressable, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSTransactionDetails from '@/components/SSTransactionDetails'
import {
  type AuthorDisplayInfo,
  useNostrMessage
} from '@/hooks/useNostrMessage'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'
import { type KeyFingerprintsByAccount } from '@/utils/psbt'

const RETRY_HIT_SLOP = 8
const AVATAR_SIZE = 24
const AVATAR_GAP = 8
const LONG_PRESS_DELAY_MS = 350

type SSNostrMessageReplyPreview = {
  authorName: string
  parentId: string
  /** Null when the parent message is not loaded. */
  text: string | null
}

type SSNostrMessageProps = {
  item: NostrDM
  account: Account | undefined
  accounts: Account[]
  keyFingerprintsByAccount: KeyFingerprintsByAccount
  formattedNpubs: Map<string, AuthorDisplayInfo>
  visibleComponents: Map<string, { sankey: boolean; status: boolean }>
  onToggleVisibility: (msgId: string, component: 'sankey' | 'status') => void
  onGoToSignFlow: (messageContent: string) => void
  /** npub treated as "you" when there is no bitcoin account (DM chats). */
  ownNpub?: string
  /** Called with the author npub when the author is pressed. */
  onAuthorPress?: (authorNpub: string) => void
  /** Called with the matched account id and a linked transaction id when a chart link is pressed. */
  onOpenLinkedTx?: (accountId: string, txId: string) => void
  /** Marks a failed outgoing message (DM send status). */
  failed?: boolean
  /** Called with the message id to re-send a failed message. */
  onRetry?: (msgId: string) => void
  /** Same author as the message above, within the grouping window: no header. */
  isContinuation?: boolean
  replyPreview?: SSNostrMessageReplyPreview
  onReplyPreviewPress?: (parentId: string) => void
  onLongPress?: (msgId: string) => void
}

type AuthorNameProps = {
  author: AuthorDisplayInfo
  isOwn: boolean
}

function AuthorName({ author, isOwn }: AuthorNameProps) {
  const primary = author.displayName ?? author.alias
  const secondary = author.displayName ? author.alias : undefined
  return (
    <SSVStack gap="none" style={styles.authorBlock}>
      <SSHStack gap="xxs" style={styles.centered}>
        <SSText
          size="sm"
          color={primary ? 'white' : 'muted'}
          numberOfLines={1}
          style={styles.authorName}
        >
          {primary ?? author.npubShort}
        </SSText>
        {secondary ? (
          <SSText size="sm" color="muted" numberOfLines={1}>
            ({secondary})
          </SSText>
        ) : null}
        {isOwn ? (
          <SSText size="sm" color="muted">
            {t('account.nostrSync.devicesGroupChat.youSuffix')}
          </SSText>
        ) : null}
      </SSHStack>
      {primary ? (
        <SSText size="xs" color="muted" numberOfLines={1}>
          {author.npubShort}
        </SSText>
      ) : null}
    </SSVStack>
  )
}

function AuthorAvatar({ author }: { author: AuthorDisplayInfo }) {
  if (author.picture) {
    return (
      <Image
        source={{ uri: author.picture }}
        style={styles.avatar}
        resizeMode="cover"
      />
    )
  }
  return <View style={[styles.avatar, { backgroundColor: author.color }]} />
}

function SSNostrMessage({
  item: msg,
  account,
  accounts,
  keyFingerprintsByAccount,
  formattedNpubs,
  visibleComponents,
  onToggleVisibility,
  onGoToSignFlow,
  ownNpub,
  onAuthorPress,
  onOpenLinkedTx,
  failed,
  onRetry,
  isContinuation = false,
  replyPreview,
  onReplyPreviewPress,
  onLongPress
}: SSNostrMessageProps) {
  const {
    authorNpub,
    isDeviceMessage,
    authorDisplayName,
    messageContent,
    transactionData,
    hasSignFlow,
    formattedDate,
    error
  } = useNostrMessage({ account, formattedNpubs, msg, ownNpub })

  function handleRetryPress() {
    onRetry?.(msg.id)
  }

  function handleAuthorPress() {
    if (!authorNpub) {
      return
    }
    onAuthorPress?.(authorNpub)
  }

  function handleLongPress() {
    onLongPress?.(msg.id)
  }

  function handleReplyPreviewPress() {
    if (replyPreview) {
      onReplyPreviewPress?.(replyPreview.parentId)
    }
  }

  function handleToggleVisibility(component: 'sankey' | 'status') {
    onToggleVisibility(msg.id, component)
  }

  function handleGoToSignFlow() {
    onGoToSignFlow(messageContent)
  }

  const visibility = visibleComponents.get(msg.id) || {
    sankey: false,
    status: false
  }

  if (error) {
    return (
      <SSVStack gap="xxs" style={styles.message}>
        <SSText size="sm" color="muted">
          {t('account.nostrSync.devicesGroupChat.displayError')}
        </SSText>
      </SSVStack>
    )
  }

  return (
    <Pressable
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={LONG_PRESS_DELAY_MS}
      style={[
        styles.message,
        isContinuation && styles.continuation,
        isDeviceMessage && styles.ownMessage
      ]}
    >
      {isContinuation ? null : (
        <SSHStack gap="xs" style={styles.header}>
          <Pressable
            onPress={handleAuthorPress}
            style={({ pressed }) => [
              styles.authorPressable,
              pressed && styles.pressed
            ]}
          >
            <AuthorAvatar author={authorDisplayName} />
            <AuthorName author={authorDisplayName} isOwn={isDeviceMessage} />
          </Pressable>
          <SSHStack gap="xxs" style={styles.status}>
            <SSText size="xs" color="muted">
              {formattedDate}
            </SSText>
            {msg.pending ? (
              <SSText size="xs" color="muted">
                ({t('account.nostrSync.devicesGroupChat.sending')})
              </SSText>
            ) : null}
            {failed ? (
              <SSText size="xs" style={styles.failedText}>
                ({t('nostrIdentity.chat.status.failed')})
              </SSText>
            ) : null}
            {failed && onRetry ? (
              <Pressable onPress={handleRetryPress} hitSlop={RETRY_HIT_SLOP}>
                <SSText size="xs" style={styles.retryText}>
                  {t('nostrErrors.source.retry')}
                </SSText>
              </Pressable>
            ) : null}
          </SSHStack>
        </SSHStack>
      )}
      <SSVStack gap="xxs" style={styles.body}>
        {replyPreview ? (
          <Pressable
            onPress={handleReplyPreviewPress}
            style={({ pressed }) => [
              styles.replyQuote,
              pressed && styles.pressed
            ]}
          >
            <SSText size="xs" color="muted" numberOfLines={1}>
              {replyPreview.authorName}
            </SSText>
            <SSText size="sm" numberOfLines={2} style={styles.replyText}>
              {replyPreview.text ??
                t('nostrIdentity.chat.reply.originalUnavailable')}
            </SSText>
          </Pressable>
        ) : null}
        {hasSignFlow && transactionData && account ? (
          <SSTransactionDetails
            transactionData={transactionData}
            account={account}
            accounts={accounts}
            keyFingerprintsByAccount={keyFingerprintsByAccount}
            visibility={visibility}
            onToggleVisibility={handleToggleVisibility}
            onGoToSignFlow={handleGoToSignFlow}
            onOpenLinkedTx={onOpenLinkedTx}
          />
        ) : (
          <SSText size="md">{messageContent}</SSText>
        )}
        {isContinuation && (msg.pending || failed) ? (
          <SSHStack gap="xxs">
            {msg.pending ? (
              <SSText size="xs" color="muted">
                {t('account.nostrSync.devicesGroupChat.sending')}
              </SSText>
            ) : null}
            {failed && onRetry ? (
              <Pressable onPress={handleRetryPress} hitSlop={RETRY_HIT_SLOP}>
                <SSText size="xs" style={styles.failedText}>
                  {t('nostrIdentity.chat.status.failed')} ·{' '}
                  {t('nostrErrors.source.retry')}
                </SSText>
              </Pressable>
            ) : null}
            {failed && !onRetry ? (
              <SSText size="xs" style={styles.failedText}>
                {t('nostrIdentity.chat.status.failed')}
              </SSText>
            ) : null}
          </SSHStack>
        ) : null}
      </SSVStack>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  authorBlock: {
    flexShrink: 1
  },
  authorName: {
    flexShrink: 1
  },
  authorPressable: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: AVATAR_GAP
  },
  avatar: {
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE
  },
  body: {
    paddingLeft: AVATAR_SIZE + AVATAR_GAP
  },
  centered: {
    alignItems: 'center'
  },
  continuation: {
    marginTop: 2
  },
  failedText: {
    color: Colors.error
  },
  header: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  message: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  ownMessage: {
    backgroundColor: Colors.gray[800]
  },
  pressed: {
    opacity: 0.7
  },
  replyQuote: {
    backgroundColor: Colors.gray[850],
    borderRadius: 4,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  replyText: {
    color: Colors.gray[300]
  },
  retryText: {
    color: Colors.white,
    textDecorationLine: 'underline'
  },
  status: {
    alignItems: 'center',
    flexShrink: 0
  }
})

export default SSNostrMessage
export type { SSNostrMessageReplyPreview }
