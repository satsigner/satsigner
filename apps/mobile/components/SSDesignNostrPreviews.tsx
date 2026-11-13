import * as nostrKinds from 'nostr-tools/kinds'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSChatComposer from '@/components/chat/SSChatComposer'
import SSChatDaySeparator from '@/components/chat/SSChatDaySeparator'
import SSMessageActionsModal from '@/components/chat/SSMessageActionsModal'
import SSMessageDetail from '@/components/chat/SSMessageDetail'
import SSNewMessagesPill from '@/components/chat/SSNewMessagesPill'
import SSNostrConversationList from '@/components/chat/SSNostrConversationList'
import SSButton from '@/components/SSButton'
import SSDesignSection from '@/components/SSDesignSection'
import SSNostrKeyFormatTabs from '@/components/SSNostrKeyFormatTabs'
import SSNostrKeyQRModal from '@/components/SSNostrKeyQRModal'
import SSNostrMessage from '@/components/SSNostrMessage'
import SSNostrNoteReactions from '@/components/SSNostrNoteReactions'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSSeparator from '@/components/SSSeparator'
import SSShadedKeyText from '@/components/SSShadedKeyText'
import {
  DESIGN_NOSTR_AUTHORS,
  DESIGN_NOSTR_CHAT_SETS,
  DESIGN_NOSTR_FOLLOWING_CONVERSATIONS,
  DESIGN_NOSTR_ME_NPUB,
  DESIGN_NOSTR_MESSAGE_DETAIL_SETS,
  DESIGN_NOSTR_OTHER_CONVERSATIONS,
  DESIGN_NOSTR_REACTION_SETS,
  DESIGN_NOSTR_SAMPLE_NSEC
} from '@/constants/designNostrSamples'
import {
  NOSTR_GROUP_CHAT_MESSAGE_MAX_LENGTH,
  NOSTR_KEY_LINE_BREAK_EVERY
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { useLocalDayStart } from '@/hooks/useLocalDayStart'
import { getAuthorLabel } from '@/hooks/useNostrMessage'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'
import {
  formatNostrKey,
  getNostrKeyLabel,
  type NostrKeyFormat
} from '@/utils/nostr'
import {
  buildChatRows,
  buildReplyPreview,
  formatChatDayLabel
} from '@/utils/nostrChatRows'
import { buildMessageDetailRows } from '@/utils/nostrMessageDetail'

const tn = _tn('settings.developer.designSystem.features')

type SetPreviewProps = {
  setIndex: number
}

type InboxTab = 'following' | 'others'

const NO_ACCOUNTS: Account[] = []
const NO_VISIBLE_COMPONENTS = new Map<
  string,
  { sankey: boolean; status: boolean }
>()
const NO_KEY_FINGERPRINTS = {}
const SAMPLE_REPLY_WRAP_COUNT = 3

function NOOP() {
  // design preview only
}

function identityDm(item: NostrDM): NostrDM {
  return item
}

function nowSeconds() {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function NostrChatPreview({ setIndex }: SetPreviewProps) {
  const { failedIds, messages } = DESIGN_NOSTR_CHAT_SETS[setIndex].data
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<NostrDM>()
  const [selected, setSelected] = useState<NostrDM>()
  const [inboxTab, setInboxTab] = useState<InboxTab>('following')
  const rows = buildChatRows(messages, identityDm)
  const messagesById = new Map(messages.map((message) => [message.id, message]))
  const todayStart = useLocalDayStart()

  function handleLongPress(messageId: string) {
    setSelected(messagesById.get(messageId))
  }

  function handleCloseActions() {
    setSelected(undefined)
  }

  function handleReply() {
    setReplyTo(selected)
    setSelected(undefined)
  }

  function handleCancelReply() {
    setReplyTo(undefined)
  }

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSDesignSection title={tn('nostrChatMessages')}>
          <View>
            {rows.map((row) => {
              if (row.kind === 'day') {
                return (
                  <SSChatDaySeparator
                    key={row.key}
                    label={formatChatDayLabel(row.dayStart, todayStart)}
                  />
                )
              }
              const preview = row.item.replyToId
                ? buildReplyPreview(row.item.replyToId, messagesById)
                : undefined
              return (
                <SSNostrMessage
                  key={row.key}
                  item={row.item}
                  account={undefined}
                  accounts={NO_ACCOUNTS}
                  keyFingerprintsByAccount={NO_KEY_FINGERPRINTS}
                  formattedNpubs={DESIGN_NOSTR_AUTHORS}
                  visibleComponents={NO_VISIBLE_COMPONENTS}
                  onToggleVisibility={NOOP}
                  onGoToSignFlow={NOOP}
                  ownNpub={DESIGN_NOSTR_ME_NPUB}
                  failed={failedIds.includes(row.item.id)}
                  onRetry={NOOP}
                  isContinuation={row.isContinuation}
                  replyPreview={
                    preview
                      ? {
                          ...preview,
                          authorName: preview.authorKey
                            ? getAuthorLabel(
                                DESIGN_NOSTR_AUTHORS,
                                preview.authorKey
                              )
                            : ''
                        }
                      : undefined
                  }
                  onReplyPreviewPress={NOOP}
                  onLongPress={handleLongPress}
                />
              )
            })}
          </View>
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('nostrChatComposer')}>
          <View style={styles.pillArea}>
            <SSNewMessagesPill
              label={t('nostrIdentity.chat.newMessages')}
              onPress={NOOP}
            />
          </View>
          <SSChatComposer
            value={input}
            onChangeText={setInput}
            onSend={NOOP}
            placeholder={t('nostrIdentity.chat.messagePlaceholder')}
            sendLabel={t('nostrIdentity.chat.send')}
            maxLength={NOSTR_GROUP_CHAT_MESSAGE_MAX_LENGTH}
            replyTo={
              replyTo
                ? {
                    authorName: getAuthorLabel(
                      DESIGN_NOSTR_AUTHORS,
                      replyTo.author
                    ),
                    text: replyTo.description
                  }
                : undefined
            }
            onCancelReply={handleCancelReply}
          />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('nostrChatInbox')}>
          <SSPairedTabs
            activeTab={inboxTab}
            primary={{
              key: 'following',
              label: t('nostrIdentity.chat.filter.following')
            }}
            secondary={{
              key: 'others',
              label: t('nostrIdentity.chat.filter.others', {
                count: DESIGN_NOSTR_OTHER_CONVERSATIONS.length
              })
            }}
            onChange={setInboxTab}
          />
          <SSNostrConversationList
            conversations={
              inboxTab === 'following'
                ? DESIGN_NOSTR_FOLLOWING_CONVERSATIONS
                : DESIGN_NOSTR_OTHER_CONVERSATIONS
            }
            onOpenPeer={NOOP}
          />
        </SSDesignSection>
      </SSVStack>
      <SSMessageActionsModal
        visible={selected !== undefined}
        preview={selected?.description ?? ''}
        canReply
        onReply={handleReply}
        onCopy={handleCloseActions}
        onDetails={handleCloseActions}
        onClose={handleCloseActions}
      />
    </SSScrollView>
  )
}

function NostrMessageDetailPreview({ setIndex }: SetPreviewProps) {
  const sample = DESIGN_NOSTR_MESSAGE_DETAIL_SETS[setIndex].data
  const rows = buildMessageDetailRows({
    authorNpub: DESIGN_NOSTR_ME_NPUB,
    createdAt: nowSeconds(),
    id: sample.message.id,
    kind: nostrKinds.PrivateDirectMessage,
    protocol: 'nip17',
    status: 'sent',
    wrapCount: SAMPLE_REPLY_WRAP_COUNT
  })

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.scrollContent}>
        <SSMessageDetail
          message={sample.message}
          rows={rows}
          tags={sample.tags}
          parent={sample.parent}
          replies={sample.replies}
          canReply={sample.canReply}
          canDeleteForEveryone={sample.canDeleteForEveryone}
          deleting={false}
          onReply={NOOP}
          onCopyText={NOOP}
          onDeleteForMe={NOOP}
          onDeleteForEveryone={NOOP}
          onOpenMessage={NOOP}
        />
      </View>
    </SSScrollView>
  )
}

function NostrReactionsPreview({ setIndex }: SetPreviewProps) {
  const { rows, summary } = DESIGN_NOSTR_REACTION_SETS[setIndex].data

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.scrollContent}>
        <SSNostrNoteReactions
          hasNextPage={rows.length > 0}
          isFetchingNextPage={false}
          isLoading={false}
          onAuthorPress={NOOP}
          onLoadMore={NOOP}
          rows={rows}
          summary={summary}
        />
      </View>
    </SSScrollView>
  )
}

function NostrKeysPreview() {
  const [format, setFormat] = useState<NostrKeyFormat>('bech32')
  const [qrVisible, setQrVisible] = useState(false)
  const publicKey =
    formatNostrKey(DESIGN_NOSTR_ME_NPUB, format) ?? DESIGN_NOSTR_ME_NPUB
  const secretKey =
    formatNostrKey(DESIGN_NOSTR_SAMPLE_NSEC, format) ?? DESIGN_NOSTR_SAMPLE_NSEC

  function handleShowQr() {
    setQrVisible(true)
  }

  function handleCloseQr() {
    setQrVisible(false)
  }

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSNostrKeyFormatTabs format={format} onChange={setFormat} />
        <SSDesignSection title={tn('nostrPublicKey')}>
          <SSShadedKeyText
            value={publicKey}
            lineBreakEvery={NOSTR_KEY_LINE_BREAK_EVERY}
          />
          <SSButton
            label={t('common.showQR')}
            onPress={handleShowQr}
            variant="outline"
          />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('nostrSampleSecretKey')}>
          <SSShadedKeyText
            value={secretKey}
            lineBreakEvery={NOSTR_KEY_LINE_BREAK_EVERY}
          />
        </SSDesignSection>
      </SSVStack>
      <SSNostrKeyQRModal
        value={DESIGN_NOSTR_ME_NPUB}
        label={getNostrKeyLabel('npub', 'bech32')}
        shareable
        visible={qrVisible}
        onClose={handleCloseQr}
      />
    </SSScrollView>
  )
}

const styles = StyleSheet.create({
  pillArea: {
    height: 64
  },
  scrollContent: {
    paddingBottom: 64
  }
})

export {
  NostrChatPreview,
  NostrKeysPreview,
  NostrMessageDetailPreview,
  NostrReactionsPreview
}
