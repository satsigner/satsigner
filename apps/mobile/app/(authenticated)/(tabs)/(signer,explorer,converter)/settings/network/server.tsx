import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
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
  const [selectedNetwork, configs, updateServer] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs,
      state.updateServer
    ])
  )

  const [selectedServers, setSelectedServers] = useState<
    Record<Network, Server>
  >({
    bitcoin: configs.bitcoin.server,
    testnet: configs.testnet.server,
    signet: configs.signet.server
  })

  const networks: Network[] = ['bitcoin', 'testnet', 'signet']

  function handleSelectServer(network: Network, server: Server) {
    setSelectedServers((prev) => ({
      ...prev,
      [network]: server
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
      <SSVStack gap="lg" justifyBetween>
        <ScrollView
          style={{ marginBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="xl">
            {networks.map((network) => (
              <SSVStack gap="md" key={network}>
                <SSVStack gap="none">
                  <SSText uppercase>{t(`bitcoin.network.${network}`)}</SSText>
                  <SSText color="muted">
                    {t(`settings.network.server.type.${network}`)}
                  </SSText>
                </SSVStack>
                <SSVStack gap="md">
                  <SSVStack gap="md">
                    {servers
                      .filter((server) => server.network === network)
                      .map((server, index) => (
                        <SSHStack key={index}>
                          <SSCheckbox
                            onPress={() => handleSelectServer(network, server)}
                            selected={
                              selectedServers[network].url === server.url &&
                              selectedServers[network].network ===
                                server.network
                            }
                          />
                          <SSVStack gap="none" style={{ flexGrow: 1 }}>
                            <SSText
                              style={{
                                lineHeight: 16,
                                textTransform: 'capitalize'
                              }}
                              size="md"
                            >
                              {`${server.name} (${server.backend})`}
                            </SSText>
                            <SSHStack gap="xs">
                              {selectedServers[network].url === server.url &&
                                selectedServers[network].network ===
                                  server.network &&
                                server.network === selectedNetwork && (
                                  <SSText
                                    style={{
                                      lineHeight: 14,
                                      color: Colors.mainGreen,
                                      opacity: 0.6
                                    }}
                                  >
                                    {t('common.connected')}
                                  </SSText>
                                )}
                              <SSText style={{ lineHeight: 14 }} color="muted">
                                {server.url}
                              </SSText>
                            </SSHStack>
                          </SSVStack>
                        </SSHStack>
                      ))}
                  </SSVStack>
                  <SSVStack style={{ marginTop: 20 }}>
                    <SSButton
                      label={t(
                        'settings.network.server.custom.add'
                      ).toUpperCase()}
                    />
                  </SSVStack>
                </SSVStack>
              </SSVStack>
            ))}
          </SSVStack>
        </ScrollView>
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
