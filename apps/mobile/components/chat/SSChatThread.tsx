import { FlashList } from '@shopify/flash-list'
import type { ListRenderItemInfo } from '@shopify/flash-list'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { createContext, use, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'

import SSChatComposer from '@/components/chat/SSChatComposer'
import type { SSChatComposerReply } from '@/components/chat/SSChatComposer'
import SSChatDaySeparator from '@/components/chat/SSChatDaySeparator'
import SSChatInvoiceCard from '@/components/chat/SSChatInvoiceCard'
import SSNewMessagesPill from '@/components/chat/SSNewMessagesPill'
import SSNostrMessage from '@/components/SSNostrMessage'
import SSPaymentMethodPicker from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import {
  NOSTR_DM_MESSAGE_MAX_LENGTH,
  NOSTR_GROUP_CHAT_AUTOSCROLL_THRESHOLD
} from '@/constants/nostr'
import { useChatInvoicePay } from '@/hooks/useChatInvoicePay'
import { useLocalDayStart } from '@/hooks/useLocalDayStart'
import { useNostrChatScroll } from '@/hooks/useNostrChatScroll'
import { getAuthorLabel } from '@/hooks/useNostrMessage'
import type { AuthorDisplayInfo } from '@/hooks/useNostrMessage'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type { Account } from '@/types/models/Account'
import type { NostrChatThreadItem, NostrDM } from '@/types/models/Nostr'
import type { Network } from '@/types/settings/blockchain'
import {
  findChatInvoices,
  isChatInvoiceExpired
} from '@/utils/chatPaymentRequests'
import type { ChatInvoice } from '@/utils/chatPaymentRequests'
import {
  buildChatRows,
  buildReplyPreview,
  findRowIndex,
  formatChatDayLabel
} from '@/utils/nostrChatRows'
import type { ChatRow } from '@/utils/nostrChatRows'

type VisibleComponents = Map<string, { sankey: boolean; status: boolean }>

type ChatInvoiceActions = {
  canPay: boolean
  network: Network
  privacyMode: boolean
  onCopy: (invoice: string) => void
  onPay: (invoice: ChatInvoice) => void
}

type ChatThreadRowContext = {
  invoiceActions: ChatInvoiceActions
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

function ChatMessageInvoices({
  actions,
  text
}: {
  actions: ChatInvoiceActions
  text: string
}) {
  const invoices = findChatInvoices(text)
  if (invoices.length === 0) {
    return null
  }
  return invoices.map((invoice) => (
    <SSChatInvoiceCard
      key={invoice.invoice}
      invoice={invoice}
      expired={isChatInvoiceExpired(invoice)}
      wrongNetwork={invoice.network !== actions.network}
      canPay={actions.canPay}
      privacyMode={actions.privacyMode}
      onPay={actions.onPay}
      onCopy={actions.onCopy}
    />
  ))
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
  const { dm, failed } = row.item
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
        <ChatMessageInvoices
          actions={context.invoiceActions}
          text={getDmText(dm)}
        />
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
  onCancelReply
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
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const invoicePay = useChatInvoicePay()

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

  function handleInvoiceCopy(invoice: string) {
    void invoicePay.copy(invoice)
  }

  const rowContext: ChatThreadRowContext = {
    formattedNpubs,
    invoiceActions: {
      canPay: invoicePay.canPay,
      network: invoicePay.network,
      onCopy: handleInvoiceCopy,
      onPay: invoicePay.pay,
      privacyMode
    },
    messagesById: new Map(items.map(({ dm }) => [dm.id, dm])),
    onAuthorPress,
    onLongPress: onMessageLongPress,
    onReplyPreviewPress: handleReplyPreviewPress,
    onToggleVisibility: handleToggleVisibility,
    ownNpub,
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
