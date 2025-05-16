import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSBitcoinNetworkExplanationLink from '@/components/SSBitcoinNetworkExplanationLink'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import type { Network, Server } from '@/types/settings/blockchain'

const tn = _tn('settings.network.explorer')

export default function NetworkSettings() {
  const router = useRouter()
  const [configMempool, updateConfigMempool] = useBlockchainStore(
    useShallow((state) => [state.configsMempool, state.updateConfigMempool])
  )

  const [localConfig, setLocalConfig] =
    useState<Record<Network, Server['url']>>(configMempool)

  const networks: Network[] = ['bitcoin', 'testnet', 'signet']

  function handleOnSave() {
    for (const network of networks) {
      updateConfigMempool(network, localConfig[network])
    }
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSVStack gap="lg" justifyBetween>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SSVStack>
            <SSText size="lg">{tn('fullDescription')}</SSText>
            {networks.map((network) => (
              <SSVStack gap="xs" key={network}>
                <SSText uppercase weight="bold">
                  {network}
                </SSText>
                <SSTextInput
                  value={localConfig[network]}
                  onChangeText={(text: string) =>
                    setLocalConfig({
                      ...localConfig,
                      [network]: text
                    })
                  }
                  style={{
                    fontSize: 16
                  }}
                />
              </SSVStack>
            ))}
            <SSBitcoinNetworkExplanationLink />
          </SSVStack>
        </ScrollView>
        <SSVStack>
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
