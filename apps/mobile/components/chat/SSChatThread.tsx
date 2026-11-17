import { FlashList } from '@shopify/flash-list'
import type { ListRenderItemInfo } from '@shopify/flash-list'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { createContext, use, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'

import SSChatAccountPicker from '@/components/chat/SSChatAccountPicker'
import SSChatComposer from '@/components/chat/SSChatComposer'
import type { SSChatComposerReply } from '@/components/chat/SSChatComposer'
import SSChatDaySeparator from '@/components/chat/SSChatDaySeparator'
import SSChatPaymentRequests from '@/components/chat/SSChatPaymentRequests'
import type { ChatPaymentActions } from '@/components/chat/SSChatPaymentRequests'
import SSChatReactions from '@/components/chat/SSChatReactions'
import SSNewMessagesPill from '@/components/chat/SSNewMessagesPill'
import SSNostrMessage from '@/components/SSNostrMessage'
import SSPaymentMethodPicker from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import {
  NOSTR_DM_MESSAGE_MAX_LENGTH,
  NOSTR_GROUP_CHAT_AUTOSCROLL_THRESHOLD
} from '@/constants/nostr'
import { useChatBitcoinRequestPay } from '@/hooks/useChatBitcoinRequestPay'
import { useChatInvoicePay } from '@/hooks/useChatInvoicePay'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import { useLocalDayStart } from '@/hooks/useLocalDayStart'
import { useNostrChatScroll } from '@/hooks/useNostrChatScroll'
import { getAuthorLabel } from '@/hooks/useNostrMessage'
import type { AuthorDisplayInfo } from '@/hooks/useNostrMessage'
import { useNow } from '@/hooks/useNow'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { Account } from '@/types/models/Account'
import type { NostrChatThreadItem, NostrDM } from '@/types/models/Nostr'
import type { ChatPaymentRequest } from '@/utils/chatPaymentRequests'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import {
  getChatAgentStatus,
  summarizeChatReactions
} from '@/utils/nostrChatReactions'
import {
  buildChatRows,
  buildReplyPreview,
  findRowIndex,
  formatChatDayLabel
} from '@/utils/nostrChatRows'
import type { ChatRow } from '@/utils/nostrChatRows'

type VisibleComponents = Map<string, { sankey: boolean; status: boolean }>

type ChatThreadRowContext = {
  paymentActions: ChatPaymentActions
  ownHex: string | null
  peerHex: string | null
  onRemoveReaction?: (reactionId: string) => void
  formattedNpubs: Map<string, AuthorDisplayInfo>
  messagesById: ReadonlyMap<string, NostrDM>
  todayStart: number
  onAuthorPress?: (authorNpub: string) => void
  onLongPress?: (msgId: string) => void
  onReplyPreviewPress: (parentId: string) => void
  onToggleVisibility: (msgId: string, component: 'sankey' | 'status') => void
  ownNpub: string
  visibleComponents: VisibleComponents
}

const ChatThreadContext = createContext<ChatThreadRowContext | null>(null)

const NO_ACCOUNTS: Account[] = []
const NO_VISIBLE_COMPONENTS: VisibleComponents = new Map()
const NO_KEY_FINGERPRINTS = {}

function ignoreSignFlow() {
  // DM threads have no bitcoin account to sign with.
}

function getThreadDm(item: NostrChatThreadItem): NostrDM {
  return item.dm
}

function getDmText(dm: NostrDM): string {
  return typeof dm.content === 'string' ? dm.content : ''
}

function ChatThreadRow({ row }: { row: ChatRow<NostrChatThreadItem> }) {
  const context = use(ChatThreadContext)
  if (!context) {
    return null
  }
  if (row.kind === 'day') {
    return (
      <SSChatDaySeparator
        label={formatChatDayLabel(row.dayStart, context.todayStart)}
      />
    )
  }
  const { dm, failed, reactions } = row.item
  // The status line only makes sense on my messages: the peer is answering them.
  const agentStatus =
    dm.author === context.ownNpub && context.peerHex
      ? getChatAgentStatus(reactions, context.peerHex)
      : null
  const preview = dm.replyToId
    ? buildReplyPreview(dm.replyToId, context.messagesById)
    : undefined
  return (
    <SSNostrMessage
      item={dm}
      account={undefined}
      accounts={NO_ACCOUNTS}
      keyFingerprintsByAccount={NO_KEY_FINGERPRINTS}
      formattedNpubs={context.formattedNpubs}
      visibleComponents={context.visibleComponents}
      onToggleVisibility={context.onToggleVisibility}
      onGoToSignFlow={ignoreSignFlow}
      ownNpub={context.ownNpub}
      onAuthorPress={context.onAuthorPress}
      failed={failed}
      isContinuation={row.isContinuation}
      replyPreview={
        preview
          ? {
              ...preview,
              authorName: preview.authorKey
                ? getAuthorLabel(context.formattedNpubs, preview.authorKey)
                : ''
            }
          : undefined
      }
      onReplyPreviewPress={context.onReplyPreviewPress}
      onLongPress={context.onLongPress}
      renderMarkdown
      attachments={
        <>
          <SSChatPaymentRequests
            actions={context.paymentActions}
            text={getDmText(dm)}
          />
          {context.onRemoveReaction ? (
            <SSChatReactions
              summaries={summarizeChatReactions(reactions, context.ownHex)}
              agentStatus={agentStatus}
              onRemove={context.onRemoveReaction}
            />
          ) : null}
        </>
      }
    />
  )
}

function renderChatThreadRow({
  item
}: ListRenderItemInfo<ChatRow<NostrChatThreadItem>>) {
  return <ChatThreadRow row={item} />
}

function getChatRowKey(row: ChatRow<NostrChatThreadItem>) {
  return row.key
}

function getChatRowType(row: ChatRow<NostrChatThreadItem>) {
  return row.kind
}

type SSChatThreadProps = {
  items: NostrChatThreadItem[]
  /** Author display info keyed by npub: us and the peer. */
  formattedNpubs: Map<string, AuthorDisplayInfo>
  onSend: (text: string) => void
  sending?: boolean
  inputValue: string
  onInputChange: (text: string) => void
  emptyText?: string
  /** npub of the identity sending from this thread (marks "you"). */
  ownNpub: string
  /** Overrides author-press navigation (default: none in DM context). */
  onAuthorPress?: (authorNpub: string) => void
  /** Called when the user scrolls to the oldest loaded message. */
  onLoadOlder?: () => void
  loadingOlder?: boolean
  onMessageLongPress?: (msgId: string) => void
  /** Reply parent that isn't in the loaded rows (e.g. open its details). */
  onOpenMessage?: (msgId: string) => void
  replyTo?: SSChatComposerReply
  onCancelReply?: () => void
  /** Hex pubkey of the peer, whose 👀 ✅ ⚠️ reactions read as agent status. */
  peerHex?: string
  /** Reactions are shown (NIP-17 threads) only when this is set. */
  onRemoveReaction?: (reactionId: string) => void
}

/**
 * Shared DM thread: bottom-anchored list rendering the SAME message card as
 * the bitcoin devices group chat (SSNostrMessage), "new messages" pill, and
 * the shared composer.
 */
export default function SSChatThread({
  items,
  formattedNpubs,
  onSend,
  sending = false,
  inputValue,
  onInputChange,
  emptyText,
  ownNpub,
  onAuthorPress,
  onLoadOlder,
  loadingOlder = false,
  onMessageLongPress,
  onOpenMessage,
  replyTo,
  onCancelReply,
  peerHex,
  onRemoveReaction
}: SSChatThreadProps) {
  const [visibleComponents, setVisibleComponents] = useState(
    NO_VISIBLE_COMPONENTS
  )
  const headerHeight = useHeaderHeight()
  const rows = buildChatRows(items, getThreadDm)
  const {
    handleListScroll,
    listRef,
    scrollToBottom,
    scrollToIndex,
    showNewMessages
  } = useNostrChatScroll<ChatRow<NostrChatThreadItem>>(items.at(-1)?.dm.id)
  const todayStart = useLocalDayStart()
  const displayPreferences = useDisplayPreferences()
  const nowMs = useNow()
  const invoicePay = useChatInvoicePay()
  const bitcoinPay = useChatBitcoinRequestPay()

  function handleSend() {
    const text = inputValue.trim()
    if (!text) {
      return
    }
    onSend(text)
  }

  function handleReplyPreviewPress(parentId: string) {
    const index = findRowIndex(rows, parentId)
    if (index === -1) {
      onOpenMessage?.(parentId)
      return
    }
    scrollToIndex(index)
  }

  function handleToggleVisibility(
    msgId: string,
    component: 'sankey' | 'status'
  ) {
    setVisibleComponents((prev) => {
      const next = new Map(prev)
      const current = next.get(msgId) ?? { sankey: false, status: false }
      next.set(msgId, { ...current, [component]: true })
      return next
    })
  }

  function handlePaymentCopy(text: string) {
    void invoicePay.copy(text)
  }

  function handlePaymentPay(request: ChatPaymentRequest) {
    if (request.kind === 'lightning') {
      invoicePay.pay(request)
      return
    }
    bitcoinPay.pay(request)
  }

  function canPayBitcoin(request: ChatPaymentRequest) {
    return request.kind === 'bitcoin' && bitcoinPay.canPay(request)
  }

  const rowContext: ChatThreadRowContext = {
    formattedNpubs,
    messagesById: new Map(items.map(({ dm }) => [dm.id, dm])),
    onAuthorPress,
    onLongPress: onMessageLongPress,
    onRemoveReaction,
    onReplyPreviewPress: handleReplyPreviewPress,
    onToggleVisibility: handleToggleVisibility,
    ownHex: getPubKeyHexFromNpub(ownNpub),
    ownNpub,
    paymentActions: {
      canPayBitcoin,
      canPayInvoice: invoicePay.canPay,
      displayPreferences,
      lightningNetwork: invoicePay.network,
      nowMs,
      onCopy: handlePaymentCopy,
      onPay: handlePaymentPay
    },
    peerHex: peerHex ?? null,
    todayStart,
    visibleComponents
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <View style={styles.messagesContainer}>
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <SSText center color="muted">
              {emptyText ?? t('nostrIdentity.chat.noMessages')}
            </SSText>
          </View>
        ) : (
          <ChatThreadContext
            // oxlint-disable-next-line react/jsx-no-constructed-context-values -- React Compiler memoizes rowContext on its inputs
            value={rowContext}
          >
            <FlashList
              ref={listRef}
              data={rows}
              renderItem={renderChatThreadRow}
              keyExtractor={getChatRowKey}
              getItemType={getChatRowType}
              extraData={rowContext}
              maintainVisibleContentPosition={{
                autoscrollToBottomThreshold:
                  NOSTR_GROUP_CHAT_AUTOSCROLL_THRESHOLD,
                startRenderingFromBottom: true
              }}
              onStartReached={onLoadOlder}
              ListHeaderComponent={
                loadingOlder ? <ActivityIndicator color={Colors.white} /> : null
              }
              onScroll={handleListScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.listContent}
            />
          </ChatThreadContext>
        )}
        {showNewMessages ? (
          <SSNewMessagesPill
            label={t('nostrIdentity.chat.newMessages')}
            onPress={scrollToBottom}
          />
        ) : null}
      </View>
      <SSChatComposer
        value={inputValue}
        onChangeText={onInputChange}
        onSend={handleSend}
        placeholder={t('nostrIdentity.chat.messagePlaceholder')}
        sendLabel={t('nostrIdentity.chat.send')}
        maxLength={NOSTR_DM_MESSAGE_MAX_LENGTH}
        disabled={sending}
        loading={sending}
        replyTo={replyTo}
        onCancelReply={onCancelReply}
      />
      <SSPaymentMethodPicker
        ref={invoicePay.paymentSheetRef}
        onSelect={invoicePay.selectMethod}
        methods={invoicePay.paymentMethods}
        amountSats={invoicePay.pendingAmountSats}
      />
      <SSChatAccountPicker
        ref={bitcoinPay.accountSheetRef}
        accounts={bitcoinPay.pendingAccounts}
        amountSats={bitcoinPay.pendingAmountSats}
        privacyMode={displayPreferences.privacyMode}
        onSelect={bitcoinPay.selectAccount}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  listContent: {
    paddingBottom: 8
  },
  messagesContainer: {
    flex: 1,
    paddingBottom: 8
  }
})
