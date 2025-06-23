import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSBitcoinNetworkExplanationLink from '@/components/SSBitcoinNetworkExplanationLink'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { type Config, type Network } from '@/types/settings/blockchain'

const tn = _tn('settings.network.config')

export default function NetworkSettings() {
  const router = useRouter()
  const [configs, updateConfig] = useBlockchainStore(
    useShallow((state) => [state.configs, state.updateConfig])
  )

  const [tempConfigs, setTempConfigs] = useState<Record<Network, Config>>({
    bitcoin: configs.bitcoin.config,
    testnet: configs.testnet.config,
    signet: configs.signet.config
  })

  const networks: Network[] = ['bitcoin', 'testnet', 'signet']

  function handleParamChange<K extends keyof Config>(
    network: Network,
    key: K,
    value: Config[K]
  ) {
    setTempConfigs((prev) => ({
      ...prev,
      [network]: {
        ...prev[network],
        [key]: value
      }
    }))
  }

  function handleOnSave() {
    updateConfig('bitcoin', tempConfigs['bitcoin'])
    updateConfig('testnet', tempConfigs['testnet'])
    updateConfig('signet', tempConfigs['signet'])
    router.back()
  }

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSVStack gap="lg" justifyBetween>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SSBitcoinNetworkExplanationLink />
          <SSVStack gap="xl" style={{ marginTop: 20 }}>
            {networks.map((network) => (
              <SSVStack gap="sm" key={network}>
                <SSVStack gap="none">
                  <SSText uppercase weight="bold" size="xl">
                    {t(`bitcoin.network.${network}`)}
                  </SSText>
                  <SSText color="muted">
                    {t(`settings.network.server.type.${network}`)}
                  </SSText>
                </SSVStack>
                <SSVStack gap="sm">
                  <SSVStack gap="xs">
                    <SSText>{tn('connectionMode.label')}</SSText>
                    <SSCheckbox
                      label={(tempConfigs[network].connectionMode === 'auto'
                        ? tn('connectionMode.auto')
                        : tn('connectionMode.manual')
                      ).toUpperCase()}
                      selected={tempConfigs[network].connectionMode === 'auto'}
                      onPress={() =>
                        handleParamChange(
                          network,
                          'connectionMode',
                          tempConfigs[network].connectionMode === 'auto'
                            ? 'manual'
                            : 'auto'
                        )
                      }
                    />
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText>{tn('connectionTestInterval')}</SSText>
                    <SSVStack gap="none">
                      <SSNumberInput
                        value={tempConfigs[
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
                        {tn('connectionTestIntervalNotice')}
                      </SSText>
                    </SSVStack>
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText>{tn('retries')}</SSText>
                    <SSNumberInput
                      value={tempConfigs[network].retries.toString()}
                      min={1}
                      max={10}
                      onChangeText={(text) =>
                        handleParamChange(network, 'retries', Number(text))
                      }
                    />
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText>{tn('timeout')}</SSText>
                    <SSNumberInput
                      value={tempConfigs[network].timeout.toString()}
                      min={1}
                      max={20}
                      onChangeText={(text) =>
                        handleParamChange(network, 'timeout', Number(text))
                      }
                    />
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText>{tn('stopGap')}</SSText>
                    <SSNumberInput
                      value={tempConfigs[network].stopGap.toString()}
                      min={1}
                      max={50}
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
