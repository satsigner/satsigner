import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCloseThin } from '@/components/icons'
import SSBitcoinNetworkExplanationLink from '@/components/SSBitcoinNetworkExplanationLink'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import { servers } from '@/constants/servers'
import useVerifyConnection from '@/hooks/useVerifyConnection'
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

  const [connectionState] = useVerifyConnection()

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
          <SSVStack gap="xl" style={{ marginTop: 20 }}>
            {networks.map((network) => (
              <SSVStack gap="md" key={network}>
                <SSVStack gap="none">
                  <SSText
                    uppercase
                    weight="light"
                    size="xl"
                    style={{ letterSpacing: 2.5 }}
                  >
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
                        <SSHStack key={index} justifyBetween>
                          <SSHStack>
                            <SSCheckbox
                              onPress={() =>
                                handleSelectServer(network, server)
                              }
                              selected={
                                selectedServers[network].url === server.url &&
                                selectedServers[network].network ===
                                  server.network
                              }
                            />
                            <TouchableOpacity
                              onPress={() =>
                                handleSelectServer(network, server)
                              }
                            >
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
                                  {(() => {
                                    const isSelected =
                                      selectedServers[network].url ===
                                        server.url &&
                                      selectedServers[network].name ===
                                        server.name &&
                                      selectedServers[network].backend ===
                                        server.backend
                                    const isCurrentNetwork =
                                      network === selectedNetwork
                                    // Only show "Connected" if this is the currently selected server
                                    // in the currently active network AND the connection is successful
                                    const isCurrentlyActiveServer =
                                      isSelected &&
                                      isCurrentNetwork &&
                                      selectedServers[network].url ===
                                        configs[selectedNetwork].server.url &&
                                      selectedServers[network].name ===
                                        configs[selectedNetwork].server.name &&
                                      selectedServers[network].backend ===
                                        configs[selectedNetwork].server.backend

                                    const shouldShowConnected =
                                      isCurrentlyActiveServer && connectionState

                                    return (
                                      shouldShowConnected && (
                                        <SSText
                                          style={{
                                            lineHeight: 14,
                                            color: Colors.mainGreen,
                                            opacity: 0.6
                                          }}
                                        >
                                          {t('common.connected')}
                                        </SSText>
                                      )
                                    )
                                  })()}
                                  <SSText
                                    style={{ lineHeight: 14 }}
                                    color="muted"
                                  >
                                    {server.url}
                                  </SSText>
                                </SSHStack>
                              </SSVStack>
                            </TouchableOpacity>
                          </SSHStack>
                          {customServers.includes(server) && (
                            <SSIconButton
                              style={{
                                padding: 10,
                                borderWidth: 1,
                                borderRadius: 400,
                                borderColor: Colors.gray[600]
                              }}
                              onPress={() => handleRemove(server)}
                            >
                              <SSIconCloseThin color={Colors.gray[200]} />
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
            style={{ marginTop: 30 }}
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
