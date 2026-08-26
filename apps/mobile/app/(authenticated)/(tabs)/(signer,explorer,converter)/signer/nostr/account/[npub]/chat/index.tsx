import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { TabView } from 'react-native-tab-view'

import SSNostrConversationList from '@/components/chat/SSNostrConversationList'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import {
  useNostrChatConversations,
  useNostrChatProfiles,
  useNostrChatSubscription
} from '@/hooks/useNostrChat'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type NostrChatProtocol } from '@/types/models/Nostr'

type ChatParams = {
  npub: string
}

type ChatRoute = {
  key: 'nip4' | 'nip17' | 'marmot' | 'mesh'
  title: string
}

export default function NostrIdentityChat() {
  const { npub } = useLocalSearchParams<ChatParams>()
  const router = useRouter()
  const layout = Dimensions.get('window')
  const [tabIndex, setTabIndex] = useState(0)

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  // DM pipeline is held while any chat screen of this identity is focused.
  useNostrChatSubscription(identity)

  const routes: ChatRoute[] = [
    { key: 'nip4', title: t('nostrIdentity.chat.tabNip4') },
    { key: 'nip17', title: t('nostrIdentity.chat.tabNip17') },
    { key: 'marmot', title: t('nostrIdentity.chat.tabMarmot') },
    { key: 'mesh', title: t('nostrIdentity.chat.tabMesh') }
  ]
  const activeProtocol: NostrChatProtocol =
    routes[tabIndex].key === 'nip4' ? 'nip04' : 'nip17'

  const nip17Conversations = useNostrChatConversations(npub, 'nip17')
  const nip04Conversations = useNostrChatConversations(npub, 'nip04')

  // Fetch kind 0 (name/picture) for every DM peer so conversations render
  // with profiles instead of raw npubs.
  const peerNpubs = useMemo(
    () =>
      [...nip17Conversations, ...nip04Conversations].map((conversation) =>
        nip19.npubEncode(conversation.peerPubkey)
      ),
    [nip17Conversations, nip04Conversations]
  )
  useNostrChatProfiles(identity?.relays, peerNpubs)

  function handleOpenPeer(peerNpub: string, protocol: NostrChatProtocol) {
    if (!npub) {
      return
    }
    router.push({
      params: { npub, peer: peerNpub, protocol },
      pathname: '/signer/nostr/account/[npub]/chat/[peer]'
    })
  }

  function handleNewChat() {
    if (!npub) {
      return
    }
    router.push({
      params: { npub, protocol: activeProtocol },
      pathname: '/signer/nostr/account/[npub]/chat/new'
    })
  }

  const renderScene = ({ route }: { route: ChatRoute }) => {
    if (route.key === 'marmot' || route.key === 'mesh') {
      return (
        <SSVStack gap="md" itemsCenter style={styles.scene}>
          <SSText color="muted">{t('nostrIdentity.chat.comingSoon')}</SSText>
        </SSVStack>
      )
    }
    const protocol = route.key === 'nip4' ? 'nip04' : 'nip17'
    const conversations =
      protocol === 'nip17' ? nip17Conversations : nip04Conversations
    return (
      <SSVStack gap="sm" style={styles.chatScene}>
        <SSNostrConversationList
          conversations={conversations}
          onOpenPeer={(peerNpub) => handleOpenPeer(peerNpub, protocol)}
        />
        <SSButton
          label={t('nostrIdentity.chat.newMessage')}
          variant="secondary"
          disabled={!identity?.nsec}
          onPress={handleNewChat}
        />
      </SSVStack>
    )
  }

  const renderTabBar = () => {
    const tabWidth = `${100 / routes.length}%` as const

    return (
      <SSHStack gap="none" style={styles.tabBar}>
        {routes.map((route, i) => (
          <SSActionButton
            key={route.key}
            style={[styles.tabButton, { width: tabWidth }]}
            onPress={() => setTabIndex(i)}
          >
            <View style={styles.tabButtonWrap}>
              <SSVStack gap="none" itemsCenter style={styles.tabButtonInner}>
                <SSText
                  size="xs"
                  uppercase
                  center
                  color={tabIndex === i ? 'white' : 'muted'}
                  style={styles.tabLabel}
                >
                  {route.title}
                </SSText>
              </SSVStack>
              {tabIndex === i ? <View style={styles.tabIndicator} /> : null}
            </View>
          </SSActionButton>
        ))}
      </SSHStack>
    )
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {privacyMode && identity.displayName
                ? NOSTR_PRIVACY_MASK
                : identity.displayName || t('nostrIdentity.title')}
            </SSText>
          )
        }}
      />
      <TabView
        navigationState={{ index: tabIndex, routes }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={setTabIndex}
        initialLayout={{ width: layout.width }}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  chatScene: {
    flex: 1,
    paddingTop: 12
  },
  emptyContainer: {
    paddingVertical: 60
  },
  scene: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  tabBar: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingVertical: 0
  },
  tabButton: {
    height: 48
  },
  tabButtonInner: {
    flex: 1,
    justifyContent: 'center',
    width: '100%'
  },
  tabButtonWrap: {
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%'
  },
  tabIndicator: {
    backgroundColor: Colors.white,
    bottom: -1,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1
  },
  tabLabel: {
    textAlign: 'center'
  }
})
