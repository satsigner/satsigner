import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { type Network, type Param } from '@/types/settings/blockchain'

export default function NetworkSettings() {
  const router = useRouter()
  const [configs, updateParam] = useBlockchainStore(
    useShallow((state) => [state.configs, state.updateParam])
  )

  const [params, setParams] = useState<Record<Network, Param>>({
    bitcoin: configs.bitcoin.param,
    testnet: configs.testnet.param,
    signet: configs.signet.param
  })

  const networks: Network[] = ['bitcoin', 'testnet', 'signet']

  function handleParamChange<K extends keyof Param>(
    network: Network,
    key: K,
    value: Param[K]
  ) {
    setParams((prev) => ({
      ...prev,
      [network]: {
        ...prev[network],
        [key]: value
      }
    }))
  }

  function handleOnSave() {
    updateParam('bitcoin', params['bitcoin'])
    updateParam('testnet', params['testnet'])
    updateParam('signet', params['signet'])
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.network.params.title')}</SSText>
          ),
          headerBackVisible: true,
          headerLeft: () => <></>,
          headerRight: undefined
        }}
      />
      <SSVStack gap="lg" justifyBetween>
        <ScrollView
          style={{ marginBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="xl">
            {networks.map((network) => (
              <SSVStack gap="md" key={network}>
                <SSVStack gap="none">
                  <SSText uppercase>{t(`bitcoin.network.${network}`)}</SSText>
                  <SSText color="muted">
                    {t(`settings.network.server.type.${network}`)}
                  </SSText>
                </SSVStack>
                <SSVStack gap="sm">
                  <SSVStack gap="xs">
                    <SSText uppercase>
                      {t('settings.network.params.connectionMode.label')}
                    </SSText>
                    <SSCheckbox
                      label={(params[network].connectionMode === 'auto'
                        ? t('settings.network.params.connectionMode.auto')
                        : t('settings.network.params.connectionMode.manual')
                      ).toUpperCase()}
                      selected={params[network].connectionMode === 'auto'}
                      onPress={() =>
                        handleParamChange(
                          network,
                          'connectionMode',
                          params[network].connectionMode === 'auto'
                            ? 'manual'
                            : 'auto'
                        )
                      }
                    />
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText uppercase>
                      {t('settings.network.params.connectionTestInterval')}
                    </SSText>
                    <SSVStack gap="none">
                      <SSNumberInput
                        value={params[
                          network
                        ].connectionTestInterval.toString()}
                        min={10}
                        max={3600}
                        onChangeText={(text) =>
                          handleParamChange(
                            network,
                            'connectionTestInterval',
                            Number(text)
                          )
                        }
                      />
                      <SSText color="muted" size="xs">
                        {t(
                          'settings.network.params.connectionTestIntervalNotice'
                        )}
                      </SSText>
                    </SSVStack>
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText uppercase>
                      {t('settings.network.params.retries')}
                    </SSText>
                    <SSNumberInput
                      value={params[network].retries.toString()}
                      min={1}
                      max={10}
                      onChangeText={(text) =>
                        handleParamChange(network, 'retries', Number(text))
                      }
                    />
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText uppercase>
                      {t('settings.network.params.timeout')}
                    </SSText>
                    <SSNumberInput
                      value={params[network].timeout.toString()}
                      min={1}
                      max={20}
                      onChangeText={(text) =>
                        handleParamChange(network, 'timeout', Number(text))
                      }
                    />
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText uppercase>
                      {t('settings.network.params.stopGap')}
                    </SSText>
                    <SSNumberInput
                      value={params[network].stopGap.toString()}
                      min={1}
                      max={30}
                      onChangeText={(text) =>
                        handleParamChange(network, 'stopGap', Number(text))
                      }
                    />
                  </SSVStack>
                </SSVStack>
              </SSVStack>
            ))}
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
