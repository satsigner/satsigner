import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { TabView } from 'react-native-tab-view'
import { useShallow } from 'zustand/react/shallow'

import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { servers } from '@/constants/servers'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Network, type Server } from '@/types/settings/blockchain'

export default function NetworkSettings() {
  const router = useRouter()
  const [configs, updateServer] = useBlockchainStore(
    useShallow((state) => [state.configs, state.updateServer])
  )

  const tabs = [{ key: 'bitcoin' }, { key: 'testnet' }, { key: 'signet' }]
  const [tabIndex, setTabIndex] = useState(0)

  const [selectedServers, setSelectedServers] = useState<
    Record<Network, Server>
  >({
    bitcoin: configs.bitcoin.server,
    testnet: configs.testnet.server,
    signet: configs.signet.server
  })

  const currentTab = tabs[tabIndex].key
  const currentSelectedServer = selectedServers[currentTab as Network]
  const [selectedUrl, setSelectedUrl] = useState(currentSelectedServer.url)

  const renderTab = () => {
    return (
      <SSHStack
        gap="none"
        justifyEvenly
        style={{
          paddingVertical: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.gray[800]
        }}
      >
        {tabs.map((tab, index) => (
          <SSActionButton
            key={tab.key}
            style={{ width: '30%', height: 48 }}
            onPress={() => setTabIndex(index)}
          >
            <SSVStack gap="none">
              <SSText
                center
                uppercase
                style={{ lineHeight: 20, letterSpacing: 3 }}
              >
                {tab.key}
              </SSText>
              {tabIndex === index && (
                <View
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: 1,
                    bottom: -15,
                    alignSelf: 'center',
                    backgroundColor: Colors.white
                  }}
                />
              )}
            </SSVStack>
          </SSActionButton>
        ))}
      </SSHStack>
    )
  }

  function handleSelectServer(server: Server) {
    setSelectedServers((prev) => ({
      ...prev,
      [currentTab]: server
    }))
  }

  function handleOnSave() {
    updateServer('bitcoin', selectedServers['bitcoin'])
    updateServer('testnet', selectedServers['testnet'])
    updateServer('signet', selectedServers['signet'])
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.network.server.title')}</SSText>
          ),
          headerBackVisible: true,
          headerLeft: () => <></>,
          headerRight: undefined
        }}
      />
      <SSVStack gap="lg" justifyBetween style={{ flexGrow: 1 }}>
        <TabView
          swipeEnabled={false}
          navigationState={{ index: tabIndex, routes: tabs }}
          renderScene={() => (
            <ScrollView
              style={{ paddingVertical: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <SSVStack gap="md">
                {servers
                  .filter((server) => server.network === tabs[tabIndex].key)
                  .map((server, index) => (
                    <SSHStack key={index}>
                      <SSCheckbox
                        onPress={() => handleSelectServer(server)}
                        selected={
                          currentSelectedServer.url === server.url &&
                          currentSelectedServer.network === server.network
                        }
                      />
                      <SSVStack gap="none" style={{ flexGrow: 1 }}>
                        <SSText style={{ lineHeight: 16 }} size="md">
                          {server.name}
                        </SSText>
                        <SSText style={{ lineHeight: 14 }} color="muted">
                          {server.url}
                        </SSText>
                      </SSVStack>
                      <SSText uppercase color="muted" size="xs">
                        {server.backend}
                      </SSText>
                    </SSHStack>
                  ))}
              </SSVStack>
              <SSVStack style={{ marginTop: 40 }} gap="sm">
                <SSText>{t('common.custom')}</SSText>
                <SSTextInput
                  value={selectedUrl}
                  onChangeText={(url) => setSelectedUrl(url)}
                />
                <SSButton
                  label={t('settings.network.server.custom.add').toUpperCase()}
                />
              </SSVStack>
            </ScrollView>
          )}
          renderTabBar={renderTab}
          onIndexChange={setTabIndex}
        />
        <SSVStack>
          <SSButton
            variant="secondary"
            label={t('common.save')}
            onPress={() => handleOnSave()}
          />
          <SSButton
            variant="ghost"
            label={t('common.cancel')}
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
