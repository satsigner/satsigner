import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'

export default function ConfigureBlockchain() {
  const router = useRouter()
  const blockchainStore = useBlockchainStore()

  const [backend, setBackend] = useState(blockchainStore.backend)
  const [network, setNetwork] = useState(blockchainStore.network)
  const [url, setUrl] = useState(blockchainStore.url)

  function handleOnSave() {
    blockchainStore.backend = backend
    blockchainStore.network = network
    blockchainStore.url = url
    router.replace('/')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>Configure Blockchain</SSText>
        }}
      />
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
            <SSVStack>
              <SSText uppercase>Backend</SSText>
              <SSCheckbox
                label="Electrum"
                selected={backend === 'electrum'}
                onPress={() => setBackend('electrum')}
              />
              <SSCheckbox
                label="Esplora"
                selected={backend === 'esplora'}
                onPress={() => setBackend('esplora')}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>Network</SSText>
              <SSCheckbox
                label="testnet"
                selected={network === 'testnet'}
                onPress={() => setNetwork('testnet')}
              />
              <SSCheckbox
                label="signet"
                selected={network === 'signet'}
                onPress={() => setNetwork('signet')}
              />
            </SSVStack>
            <SSVStack>
              <SSText uppercase>Url</SSText>
              <SSTextInput onChangeText={(url) => setUrl(url)} />
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
