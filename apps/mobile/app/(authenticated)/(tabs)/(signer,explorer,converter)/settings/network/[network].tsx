import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBlackIndicator,
  SSIconGreenIndicator,
  SSIconYellowIndicator
} from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import {
  type Backend,
  type Network,
  type Server
} from '@/types/settings/blockchain'

export default function CustomNetwork() {
  const { network } = useLocalSearchParams()

  const router = useRouter()
  const [
    selectedNetwork,
    configs,
    setSelectedNetwork,
    updateServer,
    addCustomServer
  ] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs,
      state.setSelectedNetwork,
      state.updateServer,
      state.addCustomServer
    ])
  )

  const [connectionState, connectionString, isPrivateConnection] =
    useVerifyConnection()

  const [backend, setBackend] = useState<Backend>('electrum')
  const [name, setName] = useState('')
  const [protocol, setProtocol] = useState<'tcp' | 'tls' | 'ssl'>('ssl')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [testing, setTesting] = useState(false)
  const [nodeInfo, setNodeInfo] = useState<{
    version?: string
    blockHeight?: number
    responseTime?: number
    network?: string
    software?: string
    mempoolSize?: number

    chainWork?: string
    medianFee?: number
    hashRate?: string
  } | null>(null)
  const [oldNetwork] = useState<Network>(selectedNetwork)
  const [oldServer] = useState<Server>(configs[network as Network].server)

  // Construct URL from protocol, host, and port
  const url =
    backend === 'esplora'
      ? `https://${host}${port ? `:${port}` : ''}/api`
      : `${protocol}://${host}:${port}`

  const backends: Backend[] = ['electrum', 'esplora']

  useEffect(() => {
    if (testing && !connectionState) toast.error(t('error.invalid.backend'))
  }, [testing, connectionState])

  function isValid() {
    if (!name.trim()) {
      toast.warning(t('error.require.name'))
      return false
    }

    if (!host.trim()) {
      toast.warning(t('error.require.host'))
      return false
    }

    if (!port.trim()) {
      toast.warning(t('error.require.port'))
      return false
    }

    if (!port.match(/^[0-9]+$/)) {
      toast.warning(t('error.invalid.port'))
      return false
    }

    return true
  }

  async function handleTest() {
    setTesting(false)
    setNodeInfo(null)

    if (!isValid()) return

    setSelectedNetwork(network as Network)
    updateServer(network as Network, { name, backend, network, url } as Server)

    setTesting(true)

    // Enhanced connection test with node information
    const startTime = Date.now()
    try {
      if (backend === 'electrum') {
        // Test Electrum connection and get server info
        const ElectrumClient = (await import('@/api/electrum')).default
        const client = ElectrumClient.fromUrl(url, network as Network)

        const serverInfo = await client.client.initElectrum({
          client: 'satsigner',
          version: '1.4'
        })

        const blockHeight = await client.client.blockchainHeaders_subscribe()
        const responseTime = Date.now() - startTime

        // Try to get additional blockchain info with available methods
        let mempoolSize
        try {
          // Try to get mempool info using available methods
          const mempoolInfo = await client.client
            .mempool_get_fee_histogram?.()
            .catch(() => null)
          if (mempoolInfo && Array.isArray(mempoolInfo)) {
            mempoolSize = mempoolInfo.reduce((sum: number, item: any) => {
              return sum + (Array.isArray(item) && item[1] ? item[1] : 0)
            }, 0)
          }
        } catch (_e) {
          // Mempool info not available
        }

        // Skip difficulty calculation - focus on reliably available information

        setNodeInfo({
          version: serverInfo[1] || 'Unknown',
          software: serverInfo[0] || 'Electrum',
          blockHeight: blockHeight?.height || 0,
          responseTime,
          network: network as string,
          mempoolSize
        })

        client.close()
      } else if (backend === 'esplora') {
        // Test Esplora connection and get server info
        const Esplora = (await import('@/api/esplora')).default
        const client = new Esplora(url)

        // Get basic info first
        const blockHeight = await client.getLatestBlockHeight()
        const responseTime = Date.now() - startTime

        // Try to get additional info with proper error handling
        let mempoolSize, medianFee
        try {
          const mempoolInfo = await client._call('/mempool')
          mempoolSize = mempoolInfo?.count || undefined
        } catch (_e) {
          // Esplora mempool info not available
        }

        try {
          const feeEstimates = await client.getFeeEstimates()
          medianFee = feeEstimates['6'] || feeEstimates['3'] || undefined
        } catch (_e) {
          // Esplora fee estimates not available
        }

        setNodeInfo({
          software: 'Esplora',
          blockHeight,
          responseTime,
          network: network as string,
          mempoolSize,
          medianFee
        })
      }
    } catch (_error) {
      // Failed to get node info
      // Still set basic info even if enhanced info fails
      const responseTime = Date.now() - startTime
      setNodeInfo({
        software: backend === 'electrum' ? 'Electrum' : 'Esplora',
        responseTime,
        network: network as string
      })
    }
  }

  function handleAdd() {
    if (isValid()) {
      if (!connectionState) {
        setSelectedNetwork(oldNetwork)
        updateServer(oldNetwork, oldServer)
      }

      addCustomServer({ name, backend, network, url } as Server)
      router.back()
    }
  }

  function handleCancel() {
    if (!connectionState) {
      setSelectedNetwork(oldNetwork)
      updateServer(oldNetwork, oldServer)
    }
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.network.custom.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack gap="lg" justifyBetween>
        <ScrollView
          style={{ marginBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="xl">
            <SSVStack>
              <SSText uppercase>{t('settings.network.server.backend')}</SSText>
              {backends.map((be) => (
                <SSHStack key={be}>
                  <SSCheckbox
                    key={be}
                    selected={be === backend}
                    onPress={() => setBackend(be)}
                  />
                  <TouchableOpacity onPress={() => setBackend(be)}>
                    <SSVStack gap="none" justifyBetween>
                      <SSText
                        style={{ lineHeight: 18, textTransform: 'capitalize' }}
                        size="md"
                      >
                        {be}
                      </SSText>
                      <SSText style={{ lineHeight: 14 }} color="muted">
                        {t(`settings.network.backend.${be}.description`)}
                      </SSText>
                    </SSVStack>
                  </TouchableOpacity>
                </SSHStack>
              ))}
            </SSVStack>
            <SSVStack gap="md">
              <SSVStack gap="sm">
                <SSText uppercase>{t('common.name')}</SSText>
                <SSTextInput
                  value={name}
                  onChangeText={(value) => setName(value)}
                />
              </SSVStack>
              {backend === 'electrum' && (
                <SSVStack gap="sm">
                  <SSText uppercase>
                    {t('settings.network.server.protocol')}
                  </SSText>
                  <SSHStack gap="sm" style={{ flex: 1 }}>
                    {(['tcp', 'ssl'] as const).map((protocolOption) => (
                      <SSButton
                        key={protocolOption}
                        label={`${protocolOption}://`}
                        variant={
                          protocol === protocolOption ? 'secondary' : 'ghost'
                        }
                        style={{
                          flex: 1,
                          borderWidth: protocol === protocolOption ? 0 : 1,
                          borderColor: Colors.gray[300]
                        }}
                        onPress={() => setProtocol(protocolOption)}
                      />
                    ))}
                  </SSHStack>
                </SSVStack>
              )}
              {backend === 'esplora' && (
                <SSVStack gap="sm">
                  <SSText uppercase>
                    {t('settings.network.server.protocol')}
                  </SSText>
                  <SSText color="muted" size="sm">
                    HTTPS (automatic for Esplora)
                  </SSText>
                </SSVStack>
              )}
              <SSVStack gap="sm">
                <SSText uppercase>{t('settings.network.server.host')}</SSText>
                <SSTextInput
                  value={host}
                  onChangeText={(value) => setHost(value)}
                  placeholder={
                    backend === 'electrum'
                      ? '192.168.0.144 or electrum.example.com'
                      : 'mempool.space or api.example.com'
                  }
                />
              </SSVStack>
              <SSVStack gap="sm">
                <SSText uppercase>{t('settings.network.server.port')}</SSText>
                <SSTextInput
                  value={port}
                  onChangeText={(value) => setPort(value)}
                  placeholder={
                    backend === 'electrum'
                      ? '50001 (tcp) or 50002 (ssl)'
                      : '443 or 80'
                  }
                  keyboardType="numeric"
                />
              </SSVStack>
              {testing && (
                <SSVStack gap="md" style={{ marginBottom: 24 }}>
                  <SSHStack style={{ justifyContent: 'center', gap: 0 }}>
                    {connectionState ? (
                      isPrivateConnection ? (
                        <SSIconYellowIndicator height={24} width={24} />
                      ) : (
                        <SSIconGreenIndicator height={24} width={24} />
                      )
                    ) : (
                      <SSIconBlackIndicator height={24} width={24} />
                    )}
                    <SSText
                      size="xxs"
                      uppercase
                      style={{
                        color: connectionState
                          ? Colors.gray['200']
                          : Colors.gray['450']
                      }}
                    >
                      {connectionString}
                    </SSText>
                  </SSHStack>

                  {testing && !connectionState && !nodeInfo && (
                    <SSVStack gap="sm" style={{ paddingTop: 16 }}>
                      <SSText size="sm" color="muted" center>
                        Testing connection...
                      </SSText>
                    </SSVStack>
                  )}

                  {connectionState && nodeInfo && (
                    <SSVStack gap="sm" style={{ paddingTop: 16 }}>
                      <SSHStack justifyBetween>
                        <SSText size="sm" color="muted">
                          Software
                        </SSText>
                        <SSText size="sm">{nodeInfo.software}</SSText>
                      </SSHStack>

                      {nodeInfo.version && (
                        <SSHStack justifyBetween>
                          <SSText size="sm" color="muted">
                            Version
                          </SSText>
                          <SSText size="sm">{nodeInfo.version}</SSText>
                        </SSHStack>
                      )}

                      <SSHStack justifyBetween>
                        <SSText size="sm" color="muted">
                          Response Time
                        </SSText>
                        <SSText size="sm">{nodeInfo.responseTime}ms</SSText>
                      </SSHStack>

                      <SSHStack justifyBetween>
                        <SSText size="sm" color="muted">
                          Network
                        </SSText>
                        <SSText
                          size="sm"
                          style={{ textTransform: 'capitalize' }}
                        >
                          {nodeInfo.network}
                        </SSText>
                      </SSHStack>

                      <SSHStack justifyBetween>
                        <SSText size="sm" color="muted">
                          Block Height
                        </SSText>
                        <SSText size="sm">
                          {nodeInfo.blockHeight?.toLocaleString()}
                        </SSText>
                      </SSHStack>

                      {nodeInfo.mempoolSize !== undefined && (
                        <SSHStack justifyBetween>
                          <SSText size="sm" color="muted">
                            Mempool Size
                          </SSText>
                          <SSText size="sm">
                            {nodeInfo.mempoolSize.toLocaleString()} txs
                          </SSText>
                        </SSHStack>
                      )}

                      {nodeInfo.medianFee !== undefined && (
                        <SSHStack justifyBetween>
                          <SSText size="sm" color="muted">
                            Fee Rate (6 blocks)
                          </SSText>
                          <SSText size="sm">{nodeInfo.medianFee} sat/vB</SSText>
                        </SSHStack>
                      )}
                    </SSVStack>
                  )}
                </SSVStack>
              )}
            </SSVStack>
          </SSVStack>
          <SSVStack style={{ paddingTop: 32 }}>
            <SSButton
              label={t('settings.network.server.test')}
              onPress={() => handleTest()}
            />
            <SSButton
              variant="secondary"
              label={t('common.add')}
              onPress={() => handleAdd()}
            />
            <SSButton
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => handleCancel()}
            />
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </SSMainLayout>
  )
}
