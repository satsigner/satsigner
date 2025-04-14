import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'
import SSActionButton from '@/components/SSActionButton'
import { TabView } from 'react-native-tab-view'

export default function NetworkSettings() {
  const router = useRouter()
  const [
    connectionMode,
    setConnectionMode,
    connectionInterval,
    setConnectionTnterval,
    retries,
    setRetries,
    timeout,
    setTimeout,
    stopGap,
    setStopGap
  ] = useBlockchainStore(
    useShallow((state) => [
      state.connectionMode,
      state.setConnectionMode,
      state.connectionTestInterval,
      state.setConnectionTestInterval,
      state.retries,
      state.setRetries,
      state.timeout,
      state.setTimeout,
      state.stopGap,
      state.setStopGap
    ])
  )

  const [selectedRetries, setSelectedRetries] = useState(retries.toString())
  const [selectedTimeout, setSelectedTimeout] = useState(timeout.toString())
  const [selectedStopGap, setSelectedStopGap] = useState(stopGap.toString())
  const [autoconnect, setAutoconnect] = useState(connectionMode === 'auto')
  const [interval, setInterval] = useState(connectionInterval.toString())

  function handleOnSave() {
    setConnectionMode(autoconnect ? 'auto' : 'manual')
    setConnectionTnterval(Number(interval))
    setRetries(Number(selectedRetries))
    setStopGap(Number(selectedStopGap))
    setTimeout(Number(selectedTimeout))
    router.back()
  }

  const [tabIndex, setTabIndex] = useState(0)
  const tabs = [{ key: 'bitcoin' }, { key: 'testnet' }, { key: 'signet' }]

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
                    label={(autoconnect
                      ? t('settings.network.params.connectionMode.auto')
                      : t('settings.network.params.connectionMode.manual')
                    ).toUpperCase()}
                    selected={autoconnect}
                    onPress={() => setAutoconnect(!autoconnect)}
                  />
                </SSVStack>
                <SSVStack gap="xs">
                  <SSText uppercase>
                    {t('settings.network.params.connectionTestInterval')}
                  </SSText>
                  <SSVStack gap="none">
                    <SSNumberInput
                      value={interval}
                      min={10}
                      max={3600}
                      onChangeText={setInterval}
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
                    value={selectedRetries}
                    min={1}
                    max={10}
                    onChangeText={setSelectedRetries}
                  />
                </SSVStack>
                <SSVStack gap="xs">
                  <SSText uppercase>
                    {t('settings.network.params.timeout')}
                  </SSText>
                  <SSNumberInput
                    value={selectedTimeout}
                    min={1}
                    max={20}
                    onChangeText={setSelectedTimeout}
                  />
                </SSVStack>
                <SSVStack gap="xs">
                  <SSText uppercase>
                    {t('settings.network.params.stopGap')}
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
