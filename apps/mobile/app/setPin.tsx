import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCheckCircleThin, SSIconCircleXThin } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DEFAULT_PIN, PIN_KEY } from '@/config/auth'
import useReEncryptAccounts from '@/hooks/useReEncryptAccounts'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { Layout, Sizes } from '@/styles'
import { emptyPin } from '@/utils/pin'

type Stage = 'verify' | 'set' | 're-enter'

const BOTTOM_ACTIONS_MIN_HEIGHT = Sizes.button.height * 2 + Layout.vStack.gap.md

export default function SetPin() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
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

  const [currentPinArray, setCurrentPinArray] = useState<string[]>(emptyPin)
  const [pinArray, setPinArray] = useState<string[]>(emptyPin)
  const [confirmationPinArray, setConfirmationPinArray] =
    useState<string[]>(emptyPin)
  const [currentPinWrong, setCurrentPinWrong] = useState(false)

  const currentPinFilled = !currentPinArray.includes('')
  const pinFilled = !pinArray.includes('')
  const confirmationPinFilled = !confirmationPinArray.includes('')
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
      setCurrentPinArray(emptyPin())
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
    if (showWarning) {
      router.replace('./warning')
    } else {
      router.replace('/')
    }
  }

  function handleConfirmPin() {
    setStage('re-enter')
  }

  function clearPin() {
    setPinArray(emptyPin())
  }

  function clearConfirmationPin() {
    setConfirmationPinArray(emptyPin())
  }

  async function handleSetPin() {
    if (pinArray.join('') !== confirmationPinArray.join('')) {
      return
    }
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

    if (showWarning) {
      router.push('./warning')
    } else {
      router.replace('/')
    }

    setFirstTime(false)
    setRequiresAuth(true)
  }

  function handleGoBack() {
    clearPin()
    clearConfirmationPin()
    setStage('set')
  }

  function getTitle() {
    if (stage === 'verify') {
      return t('auth.verifyPinTitle')
    }
    if (stage === 'set') {
      return t('auth.setPinTitle')
    }
    return t('auth.reenterPinTitle')
  }

  function getFeedback() {
    if (stage === 'verify' && currentPinWrong && !currentPinFilled) {
      return (
        <SSVStack itemsCenter gap="xs">
          <SSIconCircleXThin height={32} width={32} />
          <SSText uppercase size="lg" color="muted" center>
            {t('auth.wrongPin')}
          </SSText>
        </SSVStack>
      )
    }
    if (stage === 're-enter' && confirmationPinFilled && pinsMatch) {
      return (
        <SSVStack itemsCenter gap="xs">
          <SSIconCheckCircleThin height={32} width={32} />
          <SSText uppercase size="lg" color="muted" center>
            {t('auth.pinsMatch')}
          </SSText>
        </SSVStack>
      )
    }
    if (stage === 're-enter' && confirmationPinFilled && !pinsMatch) {
      return (
        <SSVStack itemsCenter gap="xs">
          <SSIconCircleXThin height={32} width={32} />
          <SSText uppercase size="lg" color="muted" center>
            {t('auth.pinsDontMatch')}
          </SSText>
        </SSVStack>
      )
    }
    return null
  }

  return (
    <SSMainLayout
      style={{
        paddingBottom: Layout.mainContainer.paddingBottom,
        paddingTop: Math.max(Layout.mainContainer.paddingTop, insets.top + 32)
      }}
    >
      <SSVStack style={{ flex: 1, height: '100%' }}>
        <SSVStack gap="md" style={{ flex: 1, width: '100%' }}>
          <SSVStack>
            <SSText uppercase size="lg" color="muted" center weight="light">
              {getTitle()}
            </SSText>
          </SSVStack>
          {stage === 'verify' && (
            <SSPinInput
              pin={currentPinArray}
              setPin={handleCurrentPinChange}
              feedback={getFeedback()}
            />
          )}
          {stage === 'set' && (
            <SSPinInput pin={pinArray} setPin={setPinArray} />
          )}
          {stage === 're-enter' && (
            <SSPinInput
              pin={confirmationPinArray}
              setPin={setConfirmationPinArray}
              feedback={getFeedback()}
            />
          )}
        </SSVStack>
        <SSVStack
          widthFull
          style={{
            justifyContent: 'flex-end',
            minHeight: BOTTOM_ACTIONS_MIN_HEIGHT
          }}
        >
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
              onPress={() => setCurrentPinArray(emptyPin())}
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
