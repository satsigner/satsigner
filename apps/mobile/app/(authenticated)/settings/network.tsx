import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import type { Backend, Network } from '@/types/settings/blockchain'
import { SSIconWarning } from '@/components/icons'

type ServerType = 'CUSTOM' | 'PUBLIC'

const networks: Network[] = ['bitcoin', 'signet', 'testnet']
const backends: Backend[] = ['esplora', 'electrum']
const serverTypes: ServerType[] = ['CUSTOM', 'PUBLIC']

export default function NetworkSettings() {
  const router = useRouter()
  const [
    backend,
    setBackend,
    network,
    setNetwork,
    url,
    setUrl,
    retries,
    setRetries,
    timeout,
    setTimeout,
    stopGap,
    setStopGap
  ] = useBlockchainStore(
    useShallow((state) => [
      state.backend,
      state.setBackend,
      state.network,
      state.setNetwork,
      state.url,
      state.setUrl,
      state.retries,
      state.setRetries,
      state.timeout,
      state.setTimeout,
      state.stopGap,
      state.setStopGap
    ])
  )

  const [selectedBackend, setSelectedBackend] = useState(backend)
  const [selectedNetwork, setSelectedNetwork] = useState(network)
  const [selectedUrl, setSelectedUrl] = useState(url)

  const [selectedRetries, setSelectedRetries] = useState(retries.toString())
  const [selectedTimeout, setSelectedTimeout] = useState(timeout.toString())
  const [selectedStopGap, setSelectedStopGap] = useState(stopGap.toString())

  const [serverType, setServerType] = useState<ServerType>('CUSTOM')

  function handleOnSave() {
    setBackend(selectedBackend)
    setNetwork(selectedNetwork)
    setUrl(selectedUrl)
    setRetries(Number(selectedRetries))
    setTimeout(Number(selectedTimeout))
    setStopGap(Number(selectedStopGap))
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.network.title')}</SSText>
          ),
          headerBackVisible: true,
          headerLeft: () => <></>,
          headerRight: undefined
        }}
      />
      <SSVStack gap="lg" justifyBetween>
        <SSHStack>
          {serverTypes.map((type) => (
            <SSButton
              key={type}
              variant="outline"
              style={{
                width: 'auto',
                flexGrow: 1,
                borderColor: type === serverType ? 'white' : 'gray'
              }}
              label={type}
              onPress={() => setServerType(type)}
            />
          ))}
        </SSHStack>
        <ScrollView>
          <SSVStack gap="lg"
            style={{
              display: serverType === 'CUSTOM' ? 'flex' : 'none'
            }}
          >
            <SSVStack>
              <SSText uppercase>{t('settings.network.backend')}</SSText>
              {backends.map((backend) => (
                <SSCheckbox
                  key={backend}
                  label={backend}
                  selected={selectedBackend === backend}
                  onPress={() => setSelectedBackend(backend)}
                />
              ))}
            </SSVStack>
            <SSVStack>
              <SSText uppercase>{t('settings.network.network')}</SSText>
              {networks.map((network: Network) => (
                <SSCheckbox
                  key={network}
                  label={network}
                  selected={selectedNetwork === network}
                  onPress={() => setSelectedNetwork(network)}
                />
              ))}
            </SSVStack>
            <SSVStack>
              <SSText uppercase>{t('settings.network.url')}</SSText>
              <SSTextInput
                value={selectedUrl}
                onChangeText={(url) => setSelectedUrl(url)}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>{t('settings.network.retries')}</SSText>
              <SSNumberInput
                value={selectedRetries}
                min={1}
                max={10}
                onChangeText={setSelectedRetries}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>{t('settings.network.timeout')}</SSText>
              <SSNumberInput
                value={selectedTimeout}
                min={1}
                max={20}
                onChangeText={setSelectedTimeout}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>{t('settings.network.stopGap')}</SSText>
              <SSNumberInput
                value={selectedStopGap}
                min={1}
                max={30}
                onChangeText={setSelectedStopGap}
              />
            </SSVStack>
          </SSVStack>
          <SSVStack
            gap="lg"
            style={{
              display: serverType === 'PUBLIC' ? 'flex' : 'none'
            }}
          >
            <SSHStack
              gap="sm"
              style={{ justifyContent: 'center', width: '100%' }}
            >
              <SSIconWarning
                height={30}
                width={30}
                fill="black"
                strokeExclamation="white"
                strokeTriangle="red"
              />
              <SSText>WARNING</SSText>
            </SSHStack>
            <SSText center style={{ paddingHorizontal: '10%' }}>
              Your data requests relating to wallet addresses, transactions, and utxos will go out to potentially untrusted server.
            </SSText>
            <SSVStack gap="md">
              <SSButton
                withSelect
                label="BLOCKSTREAM (BITCOIN)"
              />
              <SSButton label="TEST CONNECTION" />
            </SSVStack>
          </SSVStack>
        </ScrollView>
        <SSVStack>
          <SSButton
            label={t('common.save')}
            variant="secondary"
            onPress={() => handleOnSave()}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
