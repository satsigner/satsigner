import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native'
import { nip19 } from 'nostr-tools'

import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import { type NostrChatConversation } from '@/types/models/Nostr'

type SSNostrConversationListProps = {
  conversations: NostrChatConversation[]
  onOpenPeer: (peerNpub: string) => void
}

function formatConversationTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString()
}

function shortenNpub(npub: string): string {
  return `${npub.slice(0, 12)}…${npub.slice(-4)}`
}

function ConversationRow({
  conversation,
  onPress
}: {
  conversation: NostrChatConversation
  onPress: () => void
}) {
  const peerNpub = nip19.npubEncode(conversation.peerPubkey)
  const profile = useNostrStore((state) => state.profiles[peerNpub])
  const displayName = profile?.displayName

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed
      ]}
    >
      <View style={styles.avatarWrap}>
        {profile?.picture ? (
          <Image
            source={{ uri: profile.picture }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.avatarFallback}>
            <SSText size="md" style={styles.avatarFallbackText}>
              {(displayName ?? shortenNpub(peerNpub)).slice(0, 1).toUpperCase()}
            </SSText>
          </View>
        )}
      </View>
      <View style={styles.rowContent}>
        <SSText weight="medium" numberOfLines={1}>
          {displayName ?? shortenNpub(peerNpub)}
        </SSText>
        {displayName ? (
          <SSText size="xs" color="muted">
            {shortenNpub(peerNpub)}
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

export default function SSNostrConversationList({
  conversations,
  onOpenPeer
}: SSNostrConversationListProps) {
  return (
    <FlatList
      data={conversations}
      renderItem={({ item }) => (
        <ConversationRow
          conversation={item}
          onPress={() => onOpenPeer(nip19.npubEncode(item.peerPubkey))}
        />
      )}
      keyExtractor={(item) => item.peerPubkey}
      contentContainerStyle={
        conversations.length === 0 ? styles.emptyContainer : undefined
      }
      ListEmptyComponent={
        <SSText center color="muted">
          {t('nostrIdentity.chat.noConversations')}
        </SSText>
      }
    />
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
