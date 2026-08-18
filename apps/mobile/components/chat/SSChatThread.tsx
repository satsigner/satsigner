import { useHeaderHeight } from 'expo-router/react-navigation'
import { nip19 } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, StyleSheet, TextInput, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'

import SSButton from '@/components/SSButton'
import SSNostrMessage from '@/components/SSNostrMessage'
import SSText from '@/components/SSText'
import { type AuthorDisplayInfo } from '@/hooks/useNostrMessage'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import { type NostrChatMessage, type NostrDM } from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'

const SCROLL_THRESHOLD = 40

type SSChatThreadProps = {
  messages: NostrChatMessage[]
  onSend: (text: string) => void
  sending?: boolean
  inputValue: string
  onInputChange: (text: string) => void
  emptyText?: string
  /** npub of the identity sending from this thread (marks "you"). */
  ownNpub: string
  ownDisplayName?: string
  /** Overrides author-press navigation (default: none in DM context). */
  onAuthorPress?: (authorNpub: string) => void
}

/** Adapts a DM-store message to the NostrDM shape the shared card expects. */
function toNostrDM(msg: NostrChatMessage, ownHex: string): NostrDM {
  const authorHex = msg.direction === 'out' ? ownHex : msg.peerPubkey
  return {
    author: authorHex,
    content: {
      created_at: msg.created_at,
      description: msg.content,
      pubkey: authorHex
    },
    created_at: msg.created_at,
    description: msg.content,
    event: '',
    id: msg.id,
    label: 0,
    pending: msg.status === 'pending',
    read: msg.read
  }
}

function shortenNpub(npub: string): string {
  return `${npub.slice(0, 12)}...${npub.slice(-4)}`
}

/**
 * Shared DM thread: inverted list rendering the SAME message card as the
 * bitcoin devices group chat (SSNostrMessage), "new messages" pill, and the
 * group chat's composer.
 */
export default function SSChatThread({
  messages,
  onSend,
  sending = false,
  inputValue,
  onInputChange,
  emptyText,
  ownNpub,
  ownDisplayName,
  onAuthorPress
}: SSChatThreadProps) {
  const listRef = useRef<FlatList<NostrChatMessage>>(null)
  const isAtBottomRef = useRef(true)
  const [showNewMessageButton, setShowNewMessageButton] = useState(false)
  const [visibleComponents, setVisibleComponents] = useState(
    new Map<string, { sankey: boolean; status: boolean }>()
  )
  const prevMessageCountRef = useRef(messages.length)
  const profiles = useNostrStore((state) => state.profiles)
  const headerHeight = useHeaderHeight()

  const ownHex = useMemo(() => getPubKeyHexFromNpub(ownNpub) ?? '', [ownNpub])

  // Author display info for the card: us + every peer seen in this thread.
  const formattedNpubs = useMemo(() => {
    const map = new Map<string, AuthorDisplayInfo>()
    if (ownHex) {
      map.set(ownHex, {
        color: Colors.white,
        displayName: ownDisplayName,
        npubShort: shortenNpub(ownNpub)
      })
    }
    for (const msg of messages) {
      if (map.has(msg.peerPubkey)) {
        continue
      }
      const peerNpub = getPubKeyHexFromNpub(msg.peerPubkey) ?? msg.peerPubkey
      const profile = profiles[nip19SafeEncode(msg.peerPubkey)] as
        | AuthorDisplayInfo
        | undefined
      map.set(msg.peerPubkey, {
        color: Colors.gray[500],
        displayName: profile?.displayName,
        npubShort: shortenNpub(peerNpub),
        picture: profile?.picture
      })
    }
    return map
  }, [messages, ownHex, ownNpub, ownDisplayName, profiles])

  const displayedMessages = useMemo(
    () => [...messages].toReversed(),
    [messages]
  )

  useEffect(() => {
    const prevCount = prevMessageCountRef.current
    if (messages.length > prevCount && !isAtBottomRef.current) {
      setShowNewMessageButton(true)
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  function handleSend() {
    const text = inputValue.trim()
    if (!text) {
      return
    }
    onSend(text)
  }

  function handleScrollToBottom() {
    listRef.current?.scrollToOffset({ animated: true, offset: 0 })
    isAtBottomRef.current = true
    setShowNewMessageButton(false)
  }

  function handleListScroll(e: {
    nativeEvent: { contentOffset: { y: number } }
  }) {
    const atBottom = e.nativeEvent.contentOffset.y <= SCROLL_THRESHOLD
    if (isAtBottomRef.current !== atBottom) {
      isAtBottomRef.current = atBottom
      if (atBottom) {
        setShowNewMessageButton(false)
      }
    }
  }

  function handleToggleVisibility(
    msgId: string,
    component: 'sankey' | 'status'
  ) {
    setVisibleComponents((prev) => {
      const next = new Map(prev)
      const current = next.get(msgId) || { sankey: false, status: false }
      next.set(msgId, { ...current, [component]: true })
      return next
    })
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <View style={styles.messagesContainer}>
        {messages.length === 0 ? (
          // Rendered outside the inverted list so the empty state is never
          // flipped by the list's vertical inversion.
          <View style={styles.emptyContainer}>
            <SSText center color="muted">
              {emptyText ?? t('nostrIdentity.chat.noMessages')}
            </SSText>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={displayedMessages}
            renderItem={({ item }) => (
              <SSNostrMessage
                item={toNostrDM(item, ownHex)}
                account={undefined}
                accounts={[]}
                formattedNpubs={formattedNpubs}
                visibleComponents={visibleComponents}
                onToggleVisibility={handleToggleVisibility}
                onGoToSignFlow={() => undefined}
                ownNpub={ownNpub}
                onAuthorPress={onAuthorPress}
                failed={item.status === 'failed'}
              />
            )}
            keyExtractor={(item) => item.id}
            inverted
            initialNumToRender={25}
            maxToRenderPerBatch={15}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.listContent}
          />
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
          maxLength={500}
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

function nip19SafeEncode(hex: string): string {
  try {
    return /^[0-9a-f]{64}$/.test(hex) ? nip19.npubEncode(hex) : hex
  } catch {
    return hex
  }
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
