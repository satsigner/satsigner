import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'

export default function Network() {
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
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
            <SSVStack>
              <SSText uppercase>{t('settings.network.backend')}</SSText>
              <SSCheckbox
                label="Electrum"
                selected={selectedBackend === 'electrum'}
                onPress={() => setSelectedBackend('electrum')}
              />
              <SSCheckbox
                label="Esplora"
                selected={selectedBackend === 'esplora'}
                onPress={() => setSelectedBackend('esplora')}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>{t('settings.network.network')}</SSText>
              <SSCheckbox
                label="bitcoin"
                selected={selectedNetwork === 'bitcoin'}
                onPress={() => setSelectedNetwork('bitcoin')}
              />
              <SSCheckbox
                label="testnet"
                selected={selectedNetwork === 'testnet'}
                onPress={() => setSelectedNetwork('testnet')}
              />
              <SSCheckbox
                label="signet"
                selected={selectedNetwork === 'signet'}
                onPress={() => setSelectedNetwork('signet')}
              />
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
