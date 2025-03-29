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
        <ScrollView>
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
                  {t('settings.network.params.connectionTestIntervalNotice')}
                </SSText>
              </SSVStack>
            </SSVStack>
            <SSVStack gap="xs">
              <SSText uppercase>{t('settings.network.params.retries')}</SSText>
              <SSNumberInput
                value={selectedRetries}
                min={1}
                max={10}
                onChangeText={setSelectedRetries}
              />
            </SSVStack>
            <SSVStack gap="xs">
              <SSText uppercase>{t('settings.network.params.timeout')}</SSText>
              <SSNumberInput
                value={selectedTimeout}
                min={1}
                max={20}
                onChangeText={setSelectedTimeout}
              />
            </SSVStack>
            <SSVStack gap="xs">
              <SSText uppercase>{t('settings.network.params.stopGap')}</SSText>
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
