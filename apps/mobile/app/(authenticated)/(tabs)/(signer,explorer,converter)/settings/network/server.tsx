import { Stack, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCloseThin } from '@/components/icons'
import SSBitcoinNetworkExplanationLink from '@/components/SSBitcoinNetworkExplanationLink'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import { servers } from '@/constants/servers'
import { useConnectionTest } from '@/hooks/useConnectionTest'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Network, type Server } from '@/types/settings/blockchain'
import { trimOnionAddress } from '@/utils/format'

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
  const { testing, nodeInfo, testConnection, resetTest } = useConnectionTest()

  const [selectedServers, setSelectedServers] = useState<
    Record<Network, Server>
  >({
    bitcoin: configs.bitcoin.server,
    testnet: configs.testnet.server,
    signet: configs.signet.server
  })

  const [testingServer, setTestingServer] = useState<string | null>(null)
  const [currentTestBlockHeight, setCurrentTestBlockHeight] = useState<
    number | null
  >(null)

  const networks: Network[] = ['bitcoin', 'testnet', 'signet']

  // Capture block height when nodeInfo changes during testing
  useEffect(() => {
    if (testing && testingServer && nodeInfo?.blockHeight) {
      setCurrentTestBlockHeight(nodeInfo.blockHeight)
    }
  }, [testing, testingServer, nodeInfo])

  // Show toast when block height is captured
  useEffect(() => {
    if (currentTestBlockHeight && testingServer) {
      // Find the server being tested
      const server = Object.values(selectedServers).find(
        (s) => s.url === testingServer
      )
      if (server) {
        toast.success(`${server.name} (${server.url})`, {
          description: `${tn('tester.success')} - Block ${currentTestBlockHeight.toLocaleString()}`
        })
        setTestingServer(null)
      }
    }
  }, [currentTestBlockHeight, testingServer, selectedServers])

  function handleSelectServer(network: Network, server: Server) {
    setSelectedServers((prev) => ({
      ...prev,
      [network]: server
    }))
  }

  function handleRemove(server: Server) {
    removeCustomServer(server)
  }

  async function handleTestConnection(server: Server) {
    setTestingServer(server.url)
    setCurrentTestBlockHeight(null)
    await resetTest()

    try {
      const result = await testConnection(
        server.url,
        server.backend,
        server.network,
        server.proxy
      )

      if (!result.success) {
        const errorMessage = result.error || tn('tester.failed')
        toast.error(`${server.name} (${server.url})`, {
          description: errorMessage
        })
        setTestingServer(null)
      }
      // Success toast is shown by the useEffect below when block height is
      // captured. For Electrum servers that don't expose block height the
      // useEffect never fires, so we show the toast here as a fallback after
      // a short delay (giving the useEffect a chance to run first).
      if (result.success && server.backend === 'electrum') {
        setTimeout(() => {
          setTestingServer((prev) => {
            if (prev === server.url) {
              toast.success(`${server.name} (${server.url})`, {
                description: tn('tester.success')
              })
              return null
            }
            return prev
          })
        }, 500)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : tn('tester.error')
      toast.error(`${server.name} (${server.url})`, {
        description: errorMessage
      })
      setTestingServer(null)
    }
  }

  function handleOnSave() {
    updateServer('bitcoin', selectedServers['bitcoin'])
    updateServer('testnet', selectedServers['testnet'])
    updateServer('signet', selectedServers['signet'])
    router.back()
  }

  function handleEditCustomServer(network: Network, server: Server) {
    router.push(`./${network}?editUrl=${encodeURIComponent(server.url)}`)
  }

  return (
    <SSMainLayout style={{ paddingTop: 0, flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSVStack style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
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
                  <SSVStack gap="sm">
                    {servers
                      .concat(customServers)
                      .filter((server) => server.network === network)
                      .map((server, index) => (
                        <SSHStack
                          key={index}
                          justifyBetween
                          style={{
                            alignItems: 'center',
                            alignSelf: 'stretch',
                            minHeight: 48,
                            overflow: 'hidden'
                          }}
                        >
                          <SSHStack
                            gap="sm"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              alignItems: 'flex-start'
                            }}
                          >
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
                                customServers.includes(server)
                                  ? handleEditCustomServer(network, server)
                                  : handleSelectServer(network, server)
                              }
                              style={{ flex: 1, minWidth: 0 }}
                              activeOpacity={0.7}
                            >
                              <SSVStack gap="none" style={{ flex: 1 }}>
                                <SSHStack
                                  gap="xs"
                                  style={{ alignItems: 'center' }}
                                >
                                  <SSText
                                    style={{
                                      lineHeight: 16,
                                      textTransform: 'capitalize'
                                    }}
                                    size="md"
                                  >
                                    {server.name}
                                  </SSText>
                                  <SSText
                                    style={{
                                      lineHeight: 16,
                                      textTransform: 'capitalize'
                                    }}
                                    size="md"
                                    color="muted"
                                  >
                                    {server.backend}
                                  </SSText>
                                </SSHStack>
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
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {trimOnionAddress(server.url)}
                                  </SSText>
                                </SSHStack>
                              </SSVStack>
                            </TouchableOpacity>
                          </SSHStack>
                          {customServers.includes(server) && (
                            <SSIconButton
                              style={{
                                padding: 6,
                                marginLeft: 8,
                                borderWidth: 1,
                                borderRadius: 400,
                                borderColor: Colors.gray[600]
                              }}
                              onPress={() => handleRemove(server)}
                            >
                              <SSIconCloseThin
                                color={Colors.gray[200]}
                                width={10}
                                height={10}
                              />
                            </SSIconButton>
                          )}
                        </SSHStack>
                      ))}
                  </SSVStack>
                  <SSHStack gap="sm" style={{ marginTop: 12, marginBottom: 8 }}>
                    <SSButton
                      label={tn('custom.add').toUpperCase()}
                      onPress={() => router.push(`./${network}`)}
                      style={{ flex: 1 }}
                      variant="subtle"
                    />
                    <SSButton
                      variant="subtle"
                      label={t('settings.network.server.test').toUpperCase()}
                      onPress={() =>
                        handleTestConnection(selectedServers[network])
                      }
                      loading={
                        testing &&
                        testingServer === selectedServers[network].url
                      }
                      disabled={
                        testing &&
                        testingServer === selectedServers[network].url
                      }
                      style={{ flex: 1 }}
                    />
                  </SSHStack>
                </SSVStack>
              </SSVStack>
            ))}
          </SSVStack>
        </ScrollView>
        <SSVStack gap="md" style={{ flexShrink: 0, paddingTop: 16 }}>
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
