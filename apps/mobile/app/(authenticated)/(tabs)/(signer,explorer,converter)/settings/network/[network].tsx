import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSBackendSelector from '@/components/SSBackendSelector'
import SSButton from '@/components/SSButton'
import SSConnectionTestResults from '@/components/SSConnectionTestResults'
import SSProtocolSelector from '@/components/SSProtocolSelector'
import SSServerFormFields from '@/components/SSServerFormFields'
import SSText from '@/components/SSText'
import { useConnectionTest } from '@/hooks/useConnectionTest'
import { useCustomNetworkForm } from '@/hooks/useCustomNetworkForm'
import { useCustomNetworkValidation } from '@/hooks/useCustomNetworkValidation'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { type Network, type Server } from '@/types/settings/blockchain'

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
    useVerifyConnection() as [boolean, string, boolean]

  const { testing, nodeInfo, testConnection, resetTest } = useConnectionTest()
  const [oldNetwork] = useState<Network>(selectedNetwork)
  const [oldServer] = useState<Server>(configs[network as Network].server)

  const { formData, updateField, constructUrl } = useCustomNetworkForm()

  const url = constructUrl()

  const { validateWithToasts, isFormValid } = useCustomNetworkValidation(
    formData.name,
    formData.host,
    formData.port,
    url,
    formData.backend
  )

  useEffect(() => {
    if (testing && !connectionState) toast.error(t('error.invalid.backend'))
  }, [testing, connectionState])

  async function handleTest() {
    resetTest()

    if (!validateWithToasts()) return

    setSelectedNetwork(network as Network)
    updateServer(
      network as Network,
      {
        name: formData.name,
        backend: formData.backend,
        network,
        url
      } as Server
    )

    await testConnection(url, formData.backend, network as Network)
  }

  function handleAdd() {
    if (validateWithToasts()) {
      if (!connectionState) {
        setSelectedNetwork(oldNetwork)
        updateServer(oldNetwork, oldServer)
      }

      addCustomServer({
        name: formData.name,
        backend: formData.backend,
        network,
        url
      } as Server)
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
            <SSBackendSelector
              backend={formData.backend}
              onBackendChange={(backend) => updateField('backend', backend)}
            />

            <SSVStack gap="md">
              <SSServerFormFields
                backend={formData.backend}
                name={formData.name}
                host={formData.host}
                port={formData.port}
                onNameChange={(name) => updateField('name', name)}
                onHostChange={(host) => updateField('host', host)}
                onPortChange={(port) => updateField('port', port)}
              />

              <SSProtocolSelector
                backend={formData.backend}
                protocol={formData.protocol}
                onProtocolChange={(protocol) =>
                  updateField('protocol', protocol)
                }
              />

              <SSConnectionTestResults
                testing={testing}
                connectionState={connectionState}
                connectionString={connectionString}
                isPrivateConnection={isPrivateConnection}
                nodeInfo={nodeInfo || undefined}
              />
            </SSVStack>
          </SSVStack>
          <SSVStack style={{ paddingTop: 32 }}>
            <SSButton
              label={t('settings.network.server.test')}
              onPress={() => handleTest()}
              disabled={!isFormValid}
            />
            <SSButton
              variant="secondary"
              label={t('common.add')}
              onPress={() => handleAdd()}
              disabled={!isFormValid}
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
