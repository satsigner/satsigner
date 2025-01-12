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
import { i18n } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'

export default function BitcoinNetwork() {
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
            <SSText uppercase>{i18n.t('settings.bitcoinNetwork.title')}</SSText>
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
              <SSText uppercase>
                {i18n.t('settings.bitcoinNetwork.backend')}
              </SSText>
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
              <SSText uppercase>
                {i18n.t('settings.bitcoinNetwork.network')}
              </SSText>
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
              <SSText uppercase>{i18n.t('settings.bitcoinNetwork.url')}</SSText>
              <SSTextInput
                value={selectedUrl}
                onChangeText={(url) => setSelectedUrl(url)}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>
                {i18n.t('settings.bitcoinNetwork.retries')}
              </SSText>
              <SSNumberInput
                value={selectedRetries}
                min={1}
                max={10}
                onChangeText={setSelectedRetries}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>
                {i18n.t('settings.bitcoinNetwork.timeout')}
              </SSText>
              <SSNumberInput
                value={selectedTimeout}
                min={1}
                max={20}
                onChangeText={setSelectedTimeout}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>
                {i18n.t('settings.bitcoinNetwork.stopGap')}
              </SSText>
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
            label={i18n.t('common.save')}
            variant="secondary"
            onPress={() => handleOnSave()}
          />
          <SSButton
            label={i18n.t('common.cancel')}
            variant="ghost"
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
