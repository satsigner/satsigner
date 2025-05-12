import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
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
import { useSettingsStore } from '@/store/settings'

export default function Security() {
  const router = useRouter()
  const [pinMaxTries, setPinMaxTries] = useAuthStore(
    useShallow((state) => [state.pinMaxTries, state.setPinMaxTries])
  )
  const [skipSeedConfirmation, setSkipSeedConfirmation] = useSettingsStore(
    useShallow((state) => [
      state.skipSeedConfirmation,
      state.setSkipSeedConfirmation
    ])
  )

  const [localPinMaxTries, setLocalPinMaxTries] = useState(pinMaxTries)
  const [localSkipSeedWordConfirmation, setLocalSkipSeedWordConfirmation] =
    useState(skipSeedConfirmation)

  function handleOnSave() {
    setPinMaxTries(localPinMaxTries)
    setSkipSeedConfirmation(localSkipSeedWordConfirmation)
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.security.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
            <SSVStack>
              <SSText uppercase>
                {t('settings.security.maxPinTries')}: {localPinMaxTries}
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
                  onValueChange={(value) => setLocalPinMaxTries(value)}
                />
                <SSText center style={{ width: '5%' }}>
                  {SETTINGS_PIN_MAX_POSSIBLE_TRIES}
                </SSText>
              </SSHStack>
            </SSVStack>
            <SSVStack>
              <SSCheckbox
                label={t('settings.security.skipSeedConfirmation')}
                selected={localSkipSeedWordConfirmation}
                onPress={() => {
                  setLocalSkipSeedWordConfirmation(
                    !localSkipSeedWordConfirmation
                  )
                }}
              />
            </SSVStack>
            <SSVStack>
              <SSButton
                label="SET DURESS PIN"
                onPress={() => {
                  router.navigate('/setDuressPin')
                }}
              />
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
