import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconWarning } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSModal from '@/components/SSModal'
import SSSlider from '@/components/SSSlider'
import SSText from '@/components/SSText'
import {
  SETTINGS_PIN_MAX_POSSIBLE_TRIES,
  SETTINGS_PIN_MIN_POSSIBLE_TRIES
} from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'

const tn = _tn('settings.security')

export default function Security() {
  const router = useRouter()
  const [pinMaxTries, setPinMaxTries, duressPinEnabled, setDuressPinEnabled] =
    useAuthStore(
      useShallow((state) => [
        state.pinMaxTries,
        state.setPinMaxTries,
        state.duressPinEnabled,
        state.setDuressPinEnabled
      ])
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
  const [localDuressPinEnabled, setLocalDuressPinEnabled] =
    useState(duressPinEnabled)

  const [duressPinModalVisible, setDuressPinModalVisible] = useState(false)

  function handleOnSave() {
    setPinMaxTries(localPinMaxTries)
    setSkipSeedConfirmation(localSkipSeedWordConfirmation)
    setDuressPinEnabled(localDuressPinEnabled)
    router.back()
  }

  function goSetDuressPin() {
    router.navigate('/setDuressPin')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
            <SSVStack>
              <SSText uppercase>
                {tn('maxPinTries')}: {localPinMaxTries}
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
                label={tn('skipSeedConfirmation')}
                selected={localSkipSeedWordConfirmation}
                onPress={() => {
                  setLocalSkipSeedWordConfirmation(
                    !localSkipSeedWordConfirmation
                  )
                }}
              />
            </SSVStack>
            <SSVStack>
              <SSCheckbox
                label={tn('duressPinEnabled')}
                selected={localDuressPinEnabled}
                onPress={() => {
                  setLocalDuressPinEnabled(!localDuressPinEnabled)
                }}
              />
            </SSVStack>
            <SSVStack>
              <SSButton
                label={tn('duressPin')}
                onPress={() => setDuressPinModalVisible(true)}
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
      <SSModal
        visible={duressPinModalVisible}
        onClose={() => setDuressPinModalVisible(false)}
      >
        <SSVStack
          style={styles.duressPinModalContainer}
          itemsCenter
          justifyBetween
        >
          <SSHStack>
            <SSIconWarning height={30} width={30} />
            <SSText uppercase weight="bold" size="4xl">
              {t('common.warning')}
            </SSText>
            <SSIconWarning height={30} width={30} />
          </SSHStack>
          <SSVStack>
            <SSText size="lg">{tn('duressPinText1')}</SSText>
            <SSText size="lg" weight="bold">
              {tn('duressPinText2')}
            </SSText>
            <SSText size="lg" weight="bold">
              {tn('duressPinText3')}
            </SSText>
            <SSText size="lg" weight="bold">
              {tn('duressPinText4')}
            </SSText>
          </SSVStack>
          <SSButton
            label={tn('duressPin')}
            onPress={goSetDuressPin}
            variant="secondary"
            style={styles.duressPinModalBtn}
          />
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  duressPinModalContainer: {
    flex: 1,
    flexGrow: 1,
    height: '100%',
    width: '100%'
  },
  duressPinModalBtn: {
    width: '100%'
  }
})
