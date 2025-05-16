import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCloseThin } from '@/components/icons'
import SSBitcoinNetworkExplanationLink from '@/components/SSBitcoinNetworkExplanationLink'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import { servers } from '@/constants/servers'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Network, type Server } from '@/types/settings/blockchain'

const tn = _tn('settings.network.server')

export default function NetworkSettings() {
  const router = useRouter()
  const [
    selectedNetwork,
    configs,
    customServers,
    updateServer,
    removeCustomServer
  ] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs,
      state.customServers,
      state.updateServer,
      state.removeCustomServer
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

  function handleRemove(server: Server) {
    removeCustomServer(server)
  }

  function handleOnSave() {
    updateServer('bitcoin', selectedServers['bitcoin'])
    updateServer('testnet', selectedServers['testnet'])
    updateServer('signet', selectedServers['signet'])
    router.back()
  }

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSVStack gap="md" justifyBetween>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SSBitcoinNetworkExplanationLink />
          <SSVStack gap="lg" style={{ marginTop: 20 }}>
            {networks.map((network) => (
              <SSVStack gap="md" key={network}>
                <SSVStack gap="none">
                  <SSText uppercase weight="bold" size="xl">
                    {t(`bitcoin.network.${network}`)}
                  </SSText>
                  <SSText color="muted">{tn(`type.${network}`)}</SSText>
                </SSVStack>
                <SSVStack gap="md">
                  <SSVStack gap="md">
                    {servers
                      .concat(customServers)
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
                          {customServers.includes(server) && (
                            <SSIconButton
                              style={{
                                padding: 6,
                                borderWidth: 1,
                                borderRadius: 4,
                                borderColor: Colors.gray[200]
                              }}
                              onPress={() => handleRemove(server)}
                            >
                              <SSIconCloseThin color={Colors.white} />
                            </SSIconButton>
                          )}
                        </SSHStack>
                      ))}
                  </SSVStack>
                  <SSButton
                    label={tn('custom.add').toUpperCase()}
                    onPress={() => router.push(`./${network}`)}
                  />
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
