import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'

export default function BitcoinNetwork() {
  const router = useRouter()
  const [backend, setBackend, network, setNetwork, url, setUrl] =
    useBlockchainStore(
      useShallow((state) => [
        state.backend,
        state.setBackend,
        state.network,
        state.setNetwork,
        state.url,
        state.setUrl
      ])
    )

  const [currentBackend, setCurrentBackend] = useState(backend)
  const [currentNetwork, setCurrentNetwork] = useState(network)
  const [currentUrl, setCurrentUrl] = useState(url)

  function handleOnSave() {
    setBackend(currentBackend)
    setNetwork(currentNetwork)
    setUrl(currentUrl)
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
                selected={backend === 'electrum'}
                onPress={() => setCurrentBackend('electrum')}
              />
              <SSCheckbox
                label="Esplora"
                selected={backend === 'esplora'}
                onPress={() => setCurrentBackend('esplora')}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>
                {i18n.t('settings.bitcoinNetwork.network')}
              </SSText>
              <SSCheckbox
                label="testnet"
                selected={network === 'testnet'}
                onPress={() => setCurrentNetwork('testnet')}
              />
              <SSCheckbox
                label="signet"
                selected={network === 'signet'}
                onPress={() => setCurrentNetwork('signet')}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>{i18n.t('settings.bitcoinNetwork.url')}</SSText>
              <SSTextInput
                value={url}
                onChangeText={(url) => setCurrentUrl(url)}
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
