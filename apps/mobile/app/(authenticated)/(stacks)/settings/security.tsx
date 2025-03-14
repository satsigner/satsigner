import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSSlider from '@/components/SSSlider'
import SSText from '@/components/SSText'
import {
  SETTINGS_PIN_MAX_POSSIBLE_TRIES,
  SETTINGS_PIN_MIN_POSSIBLE_TRIES
} from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAuthStore } from '@/store/auth'

export default function Security() {
  const router = useRouter()
  const [pinMaxTries, setPinMaxTries] = useAuthStore(
    useShallow((state) => [state.pinMaxTries, state.setPinMaxTries])
  )

  const [currentPinMaxTries, setCurrentPinMaxTries] = useState(pinMaxTries)

  function handleOnSave() {
    setPinMaxTries(currentPinMaxTries)
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.security.title')}</SSText>
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
                {t('settings.security.maxPinTries')}: {pinMaxTries}
              </SSText>
              <SSHStack justifyBetween gap="none">
                <SSText center style={{ width: '5%' }}>
                  {SETTINGS_PIN_MIN_POSSIBLE_TRIES}
                </SSText>
                <SSSlider
                  min={SETTINGS_PIN_MIN_POSSIBLE_TRIES}
                  max={SETTINGS_PIN_MAX_POSSIBLE_TRIES}
                  value={pinMaxTries}
                  step={1}
                  onValueChange={(value) => setCurrentPinMaxTries(value)}
                />
                <SSText center style={{ width: '5%' }}>
                  {SETTINGS_PIN_MAX_POSSIBLE_TRIES}
                </SSText>
              </SSHStack>
            </SSVStack>
          </SSVStack>
        </ScrollView>
        <SSVStack>
          <SSButton
            label={t('common.save')}
            variant="secondary"
            onPress={() => handleOnSave()}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
