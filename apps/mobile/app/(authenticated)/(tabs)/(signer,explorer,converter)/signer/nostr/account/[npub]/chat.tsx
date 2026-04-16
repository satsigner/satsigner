import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { TabView } from 'react-native-tab-view'

import SSActionButton from '@/components/SSActionButton'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'

type ChatParams = {
  npub: string
}

type ChatRoute = {
  key: 'nip4' | 'nip17' | 'marmot' | 'mesh'
  title: string
}

export default function NostrIdentityChat() {
  const { npub } = useLocalSearchParams<ChatParams>()
  const layout = Dimensions.get('window')
  const [tabIndex, setTabIndex] = useState(0)

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const routes = useMemo<ChatRoute[]>(
    () => [
      { key: 'nip4', title: t('nostrIdentity.chat.tabNip4') },
      { key: 'nip17', title: t('nostrIdentity.chat.tabNip17') },
      { key: 'marmot', title: t('nostrIdentity.chat.tabMarmot') },
      { key: 'mesh', title: t('nostrIdentity.chat.tabMesh') }
    ],
    []
  )

  const renderScene = useCallback(() => {
    return (
      <SSVStack gap="md" itemsCenter style={styles.scene}>
        <SSText color="muted">{t('nostrIdentity.chat.comingSoon')}</SSText>
      </SSVStack>
    )
  }, [])

  const renderTabBar = useCallback(() => {
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
  }, [routes, tabIndex])

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
  tabButtonWrap: {
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%'
  },
  tabButtonInner: {
    flex: 1,
    justifyContent: 'center',
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
