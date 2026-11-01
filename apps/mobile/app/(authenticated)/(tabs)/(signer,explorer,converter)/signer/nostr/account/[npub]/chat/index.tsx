import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { SceneMap, TabView } from 'react-native-tab-view'

import SSNostrConversationList from '@/components/chat/SSNostrConversationList'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSNostrSourceBanner from '@/components/SSNostrSourceBanner'
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
import { isNonEmptyString } from '@/utils/string'

type ChatParams = {
  npub: string
}

type ChatRoute = {
  key: 'nip4' | 'nip17' | 'marmot' | 'mesh'
  title: string
}

function ChatConversationsScene({ protocol }: { protocol: NostrChatProtocol }) {
  const { npub } = useLocalSearchParams<ChatParams>()
  const router = useRouter()
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const conversations = useNostrChatConversations(npub, protocol)
  // Fetch kind 0 (name/picture) for every DM peer so conversations render
  // with profiles instead of raw npubs.
  useNostrChatProfiles(
    identity?.relays,
    conversations.map((conversation) => conversation.peerNpub)
  )

  function handleOpenPeer(peerNpub: string) {
    if (!isNonEmptyString(npub)) {
      return
    }
    router.push({
      params: { npub, peer: peerNpub, protocol },
      pathname: '/signer/nostr/account/[npub]/chat/[peer]'
    })
  }

  function handleNewChat() {
    if (!isNonEmptyString(npub)) {
      return
    }
    router.push({
      params: { npub, protocol },
      pathname: '/signer/nostr/account/[npub]/chat/new'
    })
  }

  return (
    <SSVStack gap="sm" style={styles.chatScene}>
      <SSNostrConversationList
        conversations={conversations}
        onOpenPeer={handleOpenPeer}
      />
      <SSButton
        label={t('nostrIdentity.chat.newMessage')}
        variant="secondary"
        disabled={!isNonEmptyString(identity?.nsec)}
        onPress={handleNewChat}
      />
    </SSVStack>
  )
}

function getChatHeaderTitle(
  privacyMode: boolean,
  displayName: string | undefined
): string {
  if (!isNonEmptyString(displayName)) {
    return t('nostrIdentity.title')
  }
  return privacyMode ? NOSTR_PRIVACY_MASK : displayName
}

function Nip04Scene() {
  return <ChatConversationsScene protocol="nip04" />
}

function Nip17Scene() {
  return <ChatConversationsScene protocol="nip17" />
}

function ComingSoonScene() {
  return (
    <SSVStack gap="md" itemsCenter style={styles.scene}>
      <SSText color="muted">{t('nostrIdentity.chat.comingSoon')}</SSText>
    </SSVStack>
  )
}

const renderScene = SceneMap({
  marmot: ComingSoonScene,
  mesh: ComingSoonScene,
  nip17: Nip17Scene,
  nip4: Nip04Scene
})

export default function NostrIdentityChat() {
  const { npub } = useLocalSearchParams<ChatParams>()
  const layout = Dimensions.get('window')
  const [tabIndex, setTabIndex] = useState(0)

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  // DM pipeline is held while any chat screen of this identity is focused.
  const {
    retry: retryPipeline,
    retrying,
    status
  } = useNostrChatSubscription(identity)

  function handleRetry() {
    void retryPipeline()
  }

  const routes: ChatRoute[] = [
    { key: 'nip4', title: t('nostrIdentity.chat.tabNip4') },
    { key: 'nip17', title: t('nostrIdentity.chat.tabNip17') },
    { key: 'marmot', title: t('nostrIdentity.chat.tabMarmot') },
    { key: 'mesh', title: t('nostrIdentity.chat.tabMesh') }
  ]

  const renderTabBar = () => {
    const tabWidth = `${100 / routes.length}%` as const

    return (
      <SSHStack gap="none" style={styles.tabBar}>
        {routes.map((route, i) => (
          <SSActionButton
            key={route.key}
            style={[styles.tabButton, { width: tabWidth }]}
            onPress={() => {
              setTabIndex(i)
            }}
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
              {getChatHeaderTitle(privacyMode, identity.displayName)}
            </SSText>
          )
        }}
      />
      {status.state === 'error' ? (
        <SSNostrSourceBanner
          source="cache"
          error={status.errorCode}
          onRetry={handleRetry}
          retrying={retrying}
        />
      ) : null}
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
