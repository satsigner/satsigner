import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list'
import { createContext, use } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import { MS_PER_SECOND } from '@/constants/time'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import { type NostrChatConversationItem } from '@/types/models/Nostr'
import { formatNpub } from '@/utils/format'
import { isNonEmptyString } from '@/utils/string'

type SSNostrConversationListProps = {
  conversations: NostrChatConversationItem[]
  onOpenPeer: (peerNpub: string) => void
}

const OpenPeerContext = createContext<((peerNpub: string) => void) | null>(null)

function formatConversationTime(timestamp: number): string {
  const date = new Date(timestamp * MS_PER_SECOND)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString()
}

function getRowStyle({ pressed }: { pressed: boolean }) {
  return [styles.row, pressed && styles.rowPressed]
}

function ConversationRow({
  conversation
}: {
  conversation: NostrChatConversationItem
}) {
  const { peerNpub } = conversation
  const onOpenPeer = use(OpenPeerContext)
  const profile = useNostrStore((state) => state.profiles[peerNpub])
  const displayName = profile?.displayName
  const label = displayName ?? formatNpub(peerNpub)

  function handlePress() {
    onOpenPeer?.(peerNpub)
  }

  return (
    <Pressable onPress={handlePress} style={getRowStyle}>
      <View style={styles.avatarWrap}>
        {isNonEmptyString(profile?.picture) ? (
          <Image
            source={{ uri: profile.picture }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.avatarFallback}>
            <SSText size="md" style={styles.avatarFallbackText}>
              {label.slice(0, 1).toUpperCase()}
            </SSText>
          </View>
        )}
      </View>
      <View style={styles.rowContent}>
        <SSText weight="medium" numberOfLines={1}>
          {label}
        </SSText>
        {isNonEmptyString(displayName) ? (
          <SSText size="xs" color="muted">
            {formatNpub(peerNpub)}
          </SSText>
        ) : null}
        <SSText size="sm" color="muted" numberOfLines={1}>
          {conversation.lastMessagePreview}
        </SSText>
      </View>
      <SSVStack gap="xxs" style={styles.rowMeta}>
        <SSText size="xs" color="muted">
          {formatConversationTime(conversation.lastMessageAt)}
        </SSText>
        {conversation.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <SSText size="xs" style={styles.unreadText}>
              {conversation.unreadCount}
            </SSText>
          </View>
        ) : null}
      </SSVStack>
    </Pressable>
  )
}

function renderConversation({
  item
}: ListRenderItemInfo<NostrChatConversationItem>) {
  return <ConversationRow conversation={item} />
}

function getConversationKey(item: NostrChatConversationItem) {
  return item.peerPubkey
}

export default function SSNostrConversationList({
  conversations,
  onOpenPeer
}: SSNostrConversationListProps) {
  if (conversations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <SSText center color="muted">
          {t('nostrIdentity.chat.noConversations')}
        </SSText>
      </View>
    )
  }

  return (
    <OpenPeerContext value={onOpenPeer}>
      <FlashList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={getConversationKey}
      />
    </OpenPeerContext>
  )
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 20,
    height: 40,
    width: 40
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  avatarFallbackText: {
    color: Colors.gray[300]
  },
  avatarWrap: {
    marginRight: 10
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  row: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    padding: 12
  },
  rowContent: {
    flex: 1,
    flexShrink: 1,
    gap: 2
  },
  rowMeta: {
    alignItems: 'flex-end',
    marginLeft: 8
  },
  rowPressed: {
    opacity: 0.7
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1
  },
  unreadText: {
    color: Colors.black,
    fontWeight: '600'
  }
})
