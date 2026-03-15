import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Platform } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCheckCircleThin, SSIconCircleXThin } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DEFAULT_PIN, PIN_KEY, PIN_SIZE } from '@/config/auth'
import useReEncryptAccounts from '@/hooks/useReEncryptAccounts'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { Layout } from '@/styles'

type Stage = 'verify' | 'set' | 're-enter'

export default function SetPin() {
  const router = useRouter()
  const { source } = useLocalSearchParams<{ source?: string }>()
  const fromSettings = source === 'settings'

  const [
    setPin,
    setFirstTime,
    setRequiresAuth,
    setSkipPin,
    skipPin,
    validatePin
  ] = useAuthStore(
    useShallow((state) => [
      state.setPin,
      state.setFirstTime,
      state.setRequiresAuth,
      state.setSkipPin,
      state.skipPin,
      state.validatePin
    ])
  )
  const showWarning = useSettingsStore((state) => state.showWarning)

  const reEncryptAccounts = useReEncryptAccounts()

  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>(
    fromSettings && !skipPin ? 'verify' : 'set'
  )

  const [currentPinArray, setCurrentPinArray] = useState<string[]>(
    Array(PIN_SIZE).fill('')
  )
  const [pinArray, setPinArray] = useState<string[]>(Array(PIN_SIZE).fill(''))
  const [confirmationPinArray, setConfirmationPinArray] = useState<string[]>(
    Array(PIN_SIZE).fill('')
  )
  const [currentPinWrong, setCurrentPinWrong] = useState(false)

  const currentPinFilled =
    currentPinArray.findIndex((text) => text === '') === -1
  const pinFilled = pinArray.findIndex((text) => text === '') === -1
  const confirmationPinFilled =
    confirmationPinArray.findIndex((text) => text === '') === -1
  const pinsMatch = pinArray.join('') === confirmationPinArray.join('')

  function handleCurrentPinChange(newPin: React.SetStateAction<string[]>) {
    const resolved =
      typeof newPin === 'function' ? newPin(currentPinArray) : newPin
    if (currentPinWrong && resolved.some((d) => d !== '')) {
      setCurrentPinWrong(false)
    }
    setCurrentPinArray(resolved)
  }

  async function handleVerifyPin() {
    const isValid = await validatePin(currentPinArray.join(''))
    if (isValid) {
      setStage('set')
      setCurrentPinWrong(false)
    } else {
      setCurrentPinArray(Array(PIN_SIZE).fill(''))
      setCurrentPinWrong(true)
    }
  }

  async function handleSetPinLater() {
    if (fromSettings) {
      setSkipPin(true)
      await setPin(DEFAULT_PIN)
      router.back()
      return
    }
    setFirstTime(false)
    setSkipPin(true)
    await setPin(DEFAULT_PIN)
    router.dismissAll()
    if (showWarning) router.navigate('./warning')
    else router.navigate('/')
  }

  async function handleConfirmPin() {
    setStage('re-enter')
  }

  function clearPin() {
    setPinArray(Array(PIN_SIZE).fill(''))
  }

  function clearConfirmationPin() {
    setConfirmationPinArray(Array(PIN_SIZE).fill(''))
  }

  async function handleSetPin() {
    if (pinArray.join('') !== confirmationPinArray.join('')) return
    setLoading(true)

    setSkipPin(false)

    const currentPinEncrypted = await getItem(PIN_KEY)
    await setPin(pinArray.join(''))
    const newPinEncrypted = await getItem(PIN_KEY)
    if (
      currentPinEncrypted &&
      newPinEncrypted &&
      currentPinEncrypted !== newPinEncrypted
    ) {
      await reEncryptAccounts(currentPinEncrypted, newPinEncrypted)
    }

    setLoading(false)

    if (fromSettings) {
      router.back()
      return
    }

    if (showWarning) router.push('./warning')
    else router.replace('/')

    setFirstTime(false)
    setRequiresAuth(true)
  }

  async function handleGoBack() {
    clearPin()
    clearConfirmationPin()
    setStage('set')
  }

  function getTitle() {
    if (stage === 'verify') return t('auth.verifyPinTitle')
    if (stage === 'set') return t('auth.setPinTitle')
    return t('auth.reenterPinTitle')
  }

  return (
    <SSMainLayout
      style={{
        paddingBottom: Layout.mainContainer.paddingBottom,
        paddingTop: '20%'
      }}
    >
      <SSVStack style={{ height: '100%' }} itemsCenter justifyBetween>
        <SSVStack gap="lg" style={{ marginTop: '10%' }}>
          <SSVStack style={{ gap: Platform.OS === 'android' ? -8 : 0 }}>
            <SSText uppercase size="lg" color="muted" center>
              {getTitle()}
            </SSText>
          </SSVStack>
          {stage === 'verify' && (
            <SSPinInput pin={currentPinArray} setPin={handleCurrentPinChange} />
          )}
          {stage === 'set' && (
            <SSPinInput pin={pinArray} setPin={setPinArray} />
          )}
          {stage === 're-enter' && (
            <SSPinInput
              pin={confirmationPinArray}
              setPin={setConfirmationPinArray}
            />
          )}
          {stage === 'verify' && currentPinWrong && !currentPinFilled && (
            <SSVStack itemsCenter gap="sm">
              <SSIconCircleXThin height={40} width={40} />
              <SSText uppercase size="lg" color="muted" center>
                {t('auth.wrongPin')}
              </SSText>
            </SSVStack>
          )}
          {confirmationPinFilled && pinsMatch && (
            <SSVStack itemsCenter gap="sm">
              <SSIconCheckCircleThin height={40} width={40} />
              <SSText uppercase size="lg" color="muted" center>
                {t('auth.pinsMatch')}
              </SSText>
            </SSVStack>
          )}
          {confirmationPinFilled && !pinsMatch && (
            <SSVStack itemsCenter gap="sm">
              <SSIconCircleXThin height={40} width={40} />
              <SSText uppercase size="lg" color="muted" center>
                {t('auth.pinsDontMatch')}
              </SSText>
            </SSVStack>
          )}
        </SSVStack>
        <SSVStack widthFull>
          {stage === 'verify' && currentPinFilled && (
            <SSButton
              label={t('auth.confirmPin')}
              variant="secondary"
              onPress={() => handleVerifyPin()}
            />
          )}
          {stage === 'set' && pinFilled && (
            <SSButton
              label={t('auth.confirmPin')}
              variant="secondary"
              onPress={() => handleConfirmPin()}
            />
          )}
          {stage === 're-enter' && confirmationPinFilled && pinsMatch && (
            <SSButton
              label={t('auth.setPin')}
              variant="secondary"
              loading={loading}
              onPress={() => handleSetPin()}
            />
          )}
          {stage === 'verify' && !currentPinFilled && (
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => router.back()}
            />
          )}
          {stage === 'verify' && currentPinFilled && (
            <SSButton
              label={t('common.clear')}
              variant="ghost"
              onPress={() => setCurrentPinArray(Array(PIN_SIZE).fill(''))}
            />
          )}
          {stage === 'set' && !pinFilled && !fromSettings && (
            <SSButton
              label={t('auth.setPinLater')}
              variant="ghost"
              onPress={() => handleSetPinLater()}
            />
          )}
          {stage === 'set' && !pinFilled && fromSettings && (
            <SSButton
              label={t('auth.noPin')}
              variant="ghost"
              onPress={() => handleSetPinLater()}
            />
          )}
          {stage === 'set' && pinFilled && (
            <SSButton
              label={t('common.clear')}
              variant="ghost"
              onPress={() => clearPin()}
            />
          )}
          {stage === 're-enter' && !confirmationPinFilled && (
            <SSButton
              label={t('common.goBack')}
              variant="ghost"
              onPress={() => handleGoBack()}
            />
          )}
          {stage === 're-enter' && confirmationPinFilled && (
            <SSButton
              label={t('common.clear')}
              variant="ghost"
              onPress={() => clearConfirmationPin()}
            />
          )}
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
