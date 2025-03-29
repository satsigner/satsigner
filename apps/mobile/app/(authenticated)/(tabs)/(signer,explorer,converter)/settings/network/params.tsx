import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'

export default function NetworkSettings() {
  const router = useRouter()
  const [retries, setRetries, timeout, setTimeout, stopGap, setStopGap] =
    useBlockchainStore(
      useShallow((state) => [
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

  function handleOnSave() {
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
        <SSVStack gap="md">
          <SSVStack>
            <SSText uppercase>{t('settings.network.params.retries')}</SSText>
            <SSNumberInput
              value={selectedRetries}
              min={1}
              max={10}
              onChangeText={setSelectedRetries}
            />
          </SSVStack>
          <SSVStack>
            <SSText uppercase>{t('settings.network.params.timeout')}</SSText>
            <SSNumberInput
              value={selectedTimeout}
              min={1}
              max={20}
              onChangeText={setSelectedTimeout}
            />
          </SSVStack>
          <SSVStack>
            <SSText uppercase>{t('settings.network.params.stopGap')}</SSText>
            <SSNumberInput
              value={selectedStopGap}
              min={1}
              max={30}
              onChangeText={setSelectedStopGap}
            />
          </SSVStack>
        </SSVStack>
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
