import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
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
  const [url, setUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [oldNetwork] = useState<Network>(selectedNetwork)
  const [oldServer] = useState<Server>(configs[network as Network].server)

  const backends: Backend[] = ['electrum', 'esplora']

  useEffect(() => {
    if (testing && !connectionState) toast.error(t('error.invalid.backend'))
  }, [testing, connectionState])

  function isValid() {
    if (!name.trim()) {
      toast.warning(t('error.require.name'))
      return false
    }

    if (!url.trim()) {
      toast.warning(t('error.require.url'))
      return false
    }

    if (backend === 'electrum' && !url.startsWith('ssl://')) {
      toast.warning(t('error.invalid.url'))
      return false
    }

    if (backend === 'esplora' && !url.startsWith('https://')) {
      toast.warning(t('error.invalid.url'))
      return false
    }

    return true
  }

  function handleTest() {
    setTesting(false)

    if (!isValid()) return

    setSelectedNetwork(network as Network)
    updateServer(network as Network, { name, backend, network, url } as Server)

    setTesting(true)
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
              <SSVStack gap="sm">
                <SSText uppercase>{t('settings.network.server.url')}</SSText>
                <SSTextInput
                  value={url}
                  onChangeText={(value) => setUrl(value)}
                />
              </SSVStack>
              {testing && (
                <SSHStack
                  style={{ justifyContent: 'center', gap: 0, marginBottom: 24 }}
                >
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
              )}
            </SSVStack>
          </SSVStack>
        </ScrollView>
        <SSVStack>
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
      </SSVStack>
    </SSMainLayout>
  )
}
