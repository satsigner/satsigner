import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'
import { useShallow } from 'zustand/react/shallow'

import { SSIconWarning } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { servers } from '@/constants/servers'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import type { Backend, Network, ServerType } from '@/types/settings/blockchain'
import SSActionButton from '@/components/SSActionButton'
import { Colors } from '@/styles'

const networks: Network[] = ['bitcoin', 'signet', 'testnet']
const backends: Backend[] = ['esplora', 'electrum']
const serverTypes: ServerType[] = ['CUSTOM', 'PUBLIC']

export default function NetworkSettings() {
  const router = useRouter()
  const [backend, setBackend, network, setNetwork, url, setUrl] =
    useBlockchainStore(
      useShallow((state) => [
        state.backend,
        state.setBackend,
        state.network,
        state.setNetwork,
        state.url,
        state.setUrl
      ])
    )

  const [selectedBackend, setSelectedBackend] = useState(backend)
  const [selectedNetwork, setSelectedNetwork] = useState(network)
  const [selectedUrl, setSelectedUrl] = useState(url)

  const serverIndex = servers.findIndex((s) => {
    return s.url === url && s.backend === backend && s.network === network
  })
  const defaultServer = serverIndex !== -1 ? servers[serverIndex] : servers[0]
  const defaultServerType = serverIndex !== -1 ? 'PUBLIC' : 'CUSTOM'

  const [serverType, setServerType] = useState<ServerType>(defaultServerType)
  const [selectedServer, setSelectedServer] = useState(defaultServer)
  const [confirmedServer, setConfirmedServer] = useState(defaultServer)
  const [serverModalVisible, setServerModalVisible] = useState(false)

  const defaultTabIndex = serverIndex !== -1 ? 1 : 0
  const [tabIndex, setTabIndex] = useState(defaultTabIndex)
  const tabs = [{ key: 'bitcoin' }, { key: 'testnet' }, { key: 'signet' }]

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

  function handleOnSave() {
    if (serverType === 'CUSTOM') {
      setBackend(selectedBackend)
      setNetwork(selectedNetwork)
      setUrl(selectedUrl)
    } else {
      setBackend(confirmedServer.backend)
      setNetwork(confirmedServer.network)
      setUrl(confirmedServer.url)
    }
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
                        onPress={() => setSelectedServer(server)}
                        selected={
                          selectedServer.url === server.url &&
                          selectedServer.network === server.network
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
      <SSSelectModal
        visible={serverModalVisible}
        title={t('settings.network.server.server.modal.title').toUpperCase()}
        onCancel={() => setServerModalVisible(false)}
        onSelect={() => {
          setConfirmedServer(selectedServer)
          setServerModalVisible(false)
        }}
      >
        {networks.map((network) => (
          <SSVStack key={network} gap="sm">
            <SSVStack gap="none">
              <SSText uppercase>{network}</SSText>
              <SSText color="muted">
                {t(`settings.network.server.type.${network}`)}
              </SSText>
            </SSVStack>
            {servers
              .filter((server) => server.network === network)
              .map((server, index) => (
                <SSHStack key={index}>
                  <SSCheckbox
                    onPress={() => setSelectedServer(server)}
                    selected={
                      selectedServer.url === server.url &&
                      selectedServer.network === server.network
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
        ))}
      </SSSelectModal>
    </SSMainLayout>
  )
}
