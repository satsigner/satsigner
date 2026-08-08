import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { TabView } from 'react-native-tab-view'

import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNostrConversationList from '@/components/chat/SSNostrConversationList'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import { useNostrContacts } from '@/hooks/useNostrContacts'
import {
  useNostrChatConversations,
  useNostrChatSubscription
} from '@/hooks/useNostrChat'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type NostrChatProtocol } from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { getNostrContactsRelays } from '@/utils/nostrContacts'

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

  const [newChatVisible, setNewChatVisible] = useState(false)
  const [newChatNpub, setNewChatNpub] = useState('')
  const [newChatError, setNewChatError] = useState('')

  // DM subscriptions live while any chat screen of this identity is focused.
  useNostrChatSubscription(identity)

  const contactsRelays = getNostrContactsRelays(identity?.relays)
  const { contacts } = useNostrContacts(npub, contactsRelays)

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

  function handleOpenPeer(peerNpub: string, protocol: NostrChatProtocol) {
    if (!npub) {
      return
    }
    router.push({
      params: { npub, peer: peerNpub, protocol },
      pathname: '/signer/nostr/account/[npub]/chat/[peer]'
    })
  }

  function handleOpenNewChat(input: string) {
    const trimmed = input.trim()
    const hex = getPubKeyHexFromNpub(trimmed)
    if (!hex) {
      setNewChatError(t('nostrIdentity.chat.invalidNpub'))
      return
    }
    setNewChatVisible(false)
    setNewChatNpub('')
    setNewChatError('')
    handleOpenPeer(trimmed, activeProtocol)
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
          onPress={() => setNewChatVisible(true)}
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

      <SSModal
        visible={newChatVisible}
        onClose={() => setNewChatVisible(false)}
        label={t('common.cancel')}
      >
        <SSVStack gap="md">
          <SSText size="lg" weight="medium" center>
            {t('nostrIdentity.chat.newMessage')}
          </SSText>
          <SSTextInput
            value={newChatNpub}
            onChangeText={(text) => {
              setNewChatNpub(text)
              setNewChatError('')
            }}
            placeholder={t('nostrIdentity.chat.npubPlaceholder')}
          />
          {newChatError ? (
            <SSText size="sm" style={{ color: Colors.error }}>
              {newChatError}
            </SSText>
          ) : null}
          <SSButton
            label={t('nostrIdentity.chat.startChat')}
            onPress={() => handleOpenNewChat(newChatNpub)}
            disabled={!newChatNpub.trim()}
          />
          {contacts.length > 0 ? (
            <>
              <SSText uppercase color="muted" size="sm">
                {t('nostrIdentity.contacts.title')}
              </SSText>
              <SSScrollView style={styles.contactList}>
                <SSVStack gap="xs">
                  {contacts.slice(0, 20).map((contact) => {
                    const contactNpub = nip19.npubEncode(contact.pubkey)
                    return (
                      <SSButton
                        key={contact.pubkey}
                        label={
                          contact.profile?.displayName ??
                          `${contactNpub.slice(0, 16)}…`
                        }
                        variant="ghost"
                        onPress={() => handleOpenNewChat(contactNpub)}
                      />
                    )
                  })}
                </SSVStack>
              </SSScrollView>
            </>
          ) : null}
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  chatScene: {
    flex: 1,
    paddingTop: 12
  },
  contactList: {
    maxHeight: 240
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
