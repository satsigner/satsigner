import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo
} from '@shopify/flash-list'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { createContext, use, useRef, useState } from 'react'
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  View
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'

import SSButton from '@/components/SSButton'
import SSNostrMessage from '@/components/SSNostrMessage'
import SSText from '@/components/SSText'
import { type AuthorDisplayInfo } from '@/hooks/useNostrMessage'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { type NostrChatThreadItem } from '@/types/models/Nostr'

const SCROLL_THRESHOLD = 40
const AUTOSCROLL_TO_BOTTOM_THRESHOLD = 0.2
const MESSAGE_MAX_LENGTH = 500

type VisibleComponents = Map<string, { sankey: boolean; status: boolean }>

type ChatThreadRowContext = {
  formattedNpubs: Map<string, AuthorDisplayInfo>
  onAuthorPress?: (authorNpub: string) => void
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

function ChatThreadRow({ item }: { item: NostrChatThreadItem }) {
  const context = use(ChatThreadContext)
  if (!context) {
    return null
  }
  return (
    <SSNostrMessage
      item={item.dm}
      account={undefined}
      accounts={NO_ACCOUNTS}
      keyFingerprintsByAccount={NO_KEY_FINGERPRINTS}
      formattedNpubs={context.formattedNpubs}
      visibleComponents={context.visibleComponents}
      onToggleVisibility={context.onToggleVisibility}
      onGoToSignFlow={ignoreSignFlow}
      ownNpub={context.ownNpub}
      onAuthorPress={context.onAuthorPress}
      failed={item.failed}
    />
  )
}

function renderChatThreadItem({
  item
}: ListRenderItemInfo<NostrChatThreadItem>) {
  return <ChatThreadRow item={item} />
}

function getChatThreadItemKey(item: NostrChatThreadItem) {
  return item.dm.id
}

function isScrolledToBottom({
  contentOffset,
  contentSize,
  layoutMeasurement
}: NativeScrollEvent): boolean {
  return (
    contentOffset.y + layoutMeasurement.height >=
    contentSize.height - SCROLL_THRESHOLD
  )
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
}

/**
 * Shared DM thread: bottom-anchored list rendering the SAME message card as
 * the bitcoin devices group chat (SSNostrMessage), "new messages" pill, and
 * the group chat's composer.
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
  loadingOlder = false
}: SSChatThreadProps) {
  const listRef = useRef<FlashListRef<NostrChatThreadItem>>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [seenNewestId, setSeenNewestId] = useState<string>()
  const [visibleComponents, setVisibleComponents] = useState(
    NO_VISIBLE_COMPONENTS
  )
  const headerHeight = useHeaderHeight()

  const newestId = items.at(-1)?.dm.id
  const showNewMessageButton =
    !isAtBottom && seenNewestId !== undefined && newestId !== seenNewestId

  function handleSend() {
    const text = inputValue.trim()
    if (!text) {
      return
    }
    onSend(text)
  }

  function handleScrollToBottom() {
    listRef.current?.scrollToEnd({ animated: true })
    setIsAtBottom(true)
  }

  function handleListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const atBottom = isScrolledToBottom(event.nativeEvent)
    if (atBottom === isAtBottom) {
      return
    }
    setIsAtBottom(atBottom)
    if (!atBottom) {
      setSeenNewestId(newestId)
    }
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

  const rowContext: ChatThreadRowContext = {
    formattedNpubs,
    onAuthorPress,
    onToggleVisibility: handleToggleVisibility,
    ownNpub,
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
              data={items}
              renderItem={renderChatThreadItem}
              keyExtractor={getChatThreadItemKey}
              extraData={rowContext}
              maintainVisibleContentPosition={{
                autoscrollToBottomThreshold: AUTOSCROLL_TO_BOTTOM_THRESHOLD,
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
        {showNewMessageButton && (
          <View style={styles.newMessageButtonContainer}>
            <SSButton
              label={t('nostrIdentity.chat.newMessages')}
              onPress={handleScrollToBottom}
              variant="secondary"
            />
          </View>
        )}
      </View>
      <SSHStack gap="sm" style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={onInputChange}
          placeholder={t('nostrIdentity.chat.messagePlaceholder')}
          placeholderTextColor={Colors.gray[500]}
          multiline
          maxLength={MESSAGE_MAX_LENGTH}
        />
        <SSButton
          style={styles.sendButton}
          label={t('nostrIdentity.chat.send')}
          onPress={handleSend}
          disabled={sending || !inputValue.trim()}
          loading={sending}
        />
      </SSHStack>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40
  },
  // Mirrors the devices group chat composer exactly.
  input: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    color: Colors.white,
    flex: 0.8,
    minHeight: 60,
    padding: 10,
    textAlignVertical: 'top'
  },
  inputContainer: {
    paddingBottom: 16,
    paddingHorizontal: 0
  },
  listContent: {
    paddingBottom: 8
  },
  messagesContainer: {
    flex: 1,
    paddingBottom: 8
  },
  newMessageButtonContainer: {
    alignSelf: 'center',
    bottom: 70,
    position: 'absolute',
    zIndex: 2
  },
  sendButton: {
    flex: 0.2
  }
})
