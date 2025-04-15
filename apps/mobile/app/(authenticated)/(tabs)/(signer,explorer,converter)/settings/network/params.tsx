import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { TabView } from 'react-native-tab-view'
import { useShallow } from 'zustand/react/shallow'

import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
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

  const tabs = [{ key: 'bitcoin' }, { key: 'testnet' }, { key: 'signet' }]
  const [tabIndex, setTabIndex] = useState(0)
  const currentTab = tabs[tabIndex].key as Network

  function handleParamChange<K extends keyof Param>(key: K, value: Param[K]) {
    setParams((prev) => ({
      ...prev,
      [currentTab]: {
        ...prev[currentTab],
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

  const renderTab = () => {
    return (
      <SSHStack
        gap="none"
        justifyEvenly
        style={{
          paddingVertical: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.gray[800]
        }}
      >
        {tabs.map((tab, index) => (
          <SSActionButton
            key={tab.key}
            style={{ width: '30%', height: 48 }}
            onPress={() => setTabIndex(index)}
          >
            <SSVStack gap="none">
              <SSText
                center
                uppercase
                style={{ lineHeight: 20, letterSpacing: 3 }}
              >
                {tab.key}
              </SSText>
              {tabIndex === index && (
                <View
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: 1,
                    bottom: -15,
                    alignSelf: 'center',
                    backgroundColor: Colors.white
                  }}
                />
              )}
            </SSVStack>
          </SSActionButton>
        ))}
      </SSHStack>
    )
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
        <TabView
          swipeEnabled={false}
          navigationState={{ index: tabIndex, routes: tabs }}
          renderScene={() => (
            <ScrollView
              style={{ paddingVertical: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <SSVStack gap="md">
                <SSVStack gap="xs">
                  <SSText uppercase>
                    {t('settings.network.params.connectionMode.label')}
                  </SSText>
                  <SSCheckbox
                    label={(params[currentTab].connectionMode === 'auto'
                      ? t('settings.network.params.connectionMode.auto')
                      : t('settings.network.params.connectionMode.manual')
                    ).toUpperCase()}
                    selected={params[currentTab].connectionMode === 'auto'}
                    onPress={() =>
                      handleParamChange(
                        'connectionMode',
                        params[currentTab].connectionMode === 'auto'
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
                        currentTab
                      ].connectionTestInterval.toString()}
                      min={10}
                      max={3600}
                      onChangeText={(text) =>
                        handleParamChange(
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
                    value={params[currentTab].retries.toString()}
                    min={1}
                    max={10}
                    onChangeText={(text) =>
                      handleParamChange('retries', Number(text))
                    }
                  />
                </SSVStack>

                <SSVStack gap="xs">
                  <SSText uppercase>
                    {t('settings.network.params.timeout')}
                  </SSText>
                  <SSNumberInput
                    value={params[currentTab].timeout.toString()}
                    min={1}
                    max={20}
                    onChangeText={(text) =>
                      handleParamChange('timeout', Number(text))
                    }
                  />
                </SSVStack>

                <SSVStack gap="xs">
                  <SSText uppercase>
                    {t('settings.network.params.stopGap')}
                  </SSText>
                  <SSNumberInput
                    value={params[currentTab].stopGap.toString()}
                    min={1}
                    max={30}
                    onChangeText={(text) =>
                      handleParamChange('stopGap', Number(text))
                    }
                  />
                </SSVStack>
              </SSVStack>
            </ScrollView>
          )}
          renderTabBar={renderTab}
          onIndexChange={setTabIndex}
        />
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
