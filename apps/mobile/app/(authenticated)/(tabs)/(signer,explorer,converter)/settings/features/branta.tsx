import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn } from '@/locales'
import { useBrantaSettingsStore } from '@/store/brantaSettings'
import { type BrantaTriggerMode } from '@/types/models/Branta'

const tl = tn('settings.features.branta')

const VERIFICATION_MODES: BrantaTriggerMode[] = ['off', 'auto', 'on_request']
const LOGO_MODES: BrantaTriggerMode[] = ['off', 'auto', 'on_request']

function BrantaSettingsPage() {
  const router = useRouter()
  const [
    verificationMode,
    logoPrefetchMode,
    setVerificationMode,
    setLogoPrefetchMode
  ] = useBrantaSettingsStore(
    useShallow((state) => [
      state.verificationMode,
      state.logoPrefetchMode,
      state.setVerificationMode,
      state.setLogoPrefetchMode
    ])
  )

  const [selectedVerificationMode, setSelectedVerificationMode] =
    useState(verificationMode)
  const [selectedLogoPrefetchMode, setSelectedLogoPrefetchMode] =
    useState(logoPrefetchMode)

  const showLogoSettings = selectedVerificationMode !== 'off'

  function handleSave() {
    setVerificationMode(selectedVerificationMode)
    setLogoPrefetchMode(
      selectedVerificationMode === 'off' ? 'off' : selectedLogoPrefetchMode
    )
    router.back()
  }

  function modeLabel(
    mode: BrantaTriggerMode,
    prefix: 'verification' | 'logoPrefetch'
  ) {
    if (mode === 'off') {
      return tl(`${prefix}.mode.off`)
    }
    if (mode === 'auto') {
      return tl(`${prefix}.mode.auto`)
    }
    return tl(`${prefix}.mode.onRequest`)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => <SSText uppercase>{tl('title')}</SSText>
        }}
      />
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
            <SSVStack gap="sm">
              <SSText>{tl('verification.title')}</SSText>
              <SSText color="muted" size="sm">
                {tl('verification.disclosure')}
              </SSText>
              {VERIFICATION_MODES.map((mode) => (
                <SSRadioButton
                  key={mode}
                  label={modeLabel(mode, 'verification')}
                  selected={selectedVerificationMode === mode}
                  onPress={() => setSelectedVerificationMode(mode)}
                />
              ))}
            </SSVStack>

            {showLogoSettings ? (
              <SSVStack gap="sm">
                <SSText>{tl('logoPrefetch.title')}</SSText>
                <SSText color="muted" size="sm">
                  {tl('logoPrefetch.disclosure')}
                </SSText>
                {LOGO_MODES.map((mode) => (
                  <SSRadioButton
                    key={mode}
                    label={modeLabel(mode, 'logoPrefetch')}
                    selected={selectedLogoPrefetchMode === mode}
                    onPress={() => setSelectedLogoPrefetchMode(mode)}
                  />
                ))}
              </SSVStack>
            ) : null}
          </SSVStack>
        </ScrollView>
        <SSVStack>
          <SSButton
            label={t('common.save')}
            variant="secondary"
            onPress={handleSave}
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

export default BrantaSettingsPage
