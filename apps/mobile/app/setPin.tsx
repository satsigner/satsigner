import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Platform } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCheckCircleThin, SSIconCircleXThin } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { PIN_SIZE } from '@/config/auth'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAuthStore } from '@/store/auth'
import { Layout } from '@/styles'

type Stage = 'set' | 're-enter'

export default function SetPin() {
  const router = useRouter()
  const [setFirstTime, setPin, setRequiresAuth] = useAuthStore(
    useShallow((state) => [
      state.setFirstTime,
      state.setPin,
      state.setRequiresAuth
    ])
  )

  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>('set')

  const [pinArray, setPinArray] = useState<string[]>(Array(PIN_SIZE).fill(''))
  const [confirmationPinArray, setConfirmationPinArray] = useState<string[]>(
    Array(PIN_SIZE).fill('')
  )

  const pinFilled = pinArray.findIndex((text) => text === '') === -1
  const confirmationPinFilled =
    confirmationPinArray.findIndex((text) => text === '') === -1
  const pinsMatch = pinArray.join('') === confirmationPinArray.join('')

  function handleSetPinLater() {
    setFirstTime(false)
    router.replace('/')
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
    await setPin(pinArray.join(''))
    setLoading(false)
    router.replace('/')
    setFirstTime(false)
    setRequiresAuth(true)
  }

  async function handleGoBack() {
    clearPin()
    clearConfirmationPin()
    setStage('set')
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
              {stage === 'set'
                ? i18n.t('auth.setPin.0')
                : i18n.t('auth.reenterPin.0')}
            </SSText>
            <SSText uppercase size="lg" color="muted" center>
              {stage === 'set'
                ? i18n.t('auth.setPin.1')
                : i18n.t('auth.reenterPin.1')}
            </SSText>
          </SSVStack>
          {stage === 'set' && (
            <SSPinInput pin={pinArray} setPin={setPinArray} />
          )}
          {stage === 're-enter' && (
            <SSPinInput
              pin={confirmationPinArray}
              setPin={setConfirmationPinArray}
            />
          )}
          {confirmationPinFilled && pinsMatch && (
            <SSVStack itemsCenter gap="sm">
              <SSIconCheckCircleThin height={40} width={40} />
              <SSText uppercase size="lg" color="muted" center>
                {i18n.t('auth.pinsMatch')}
              </SSText>
            </SSVStack>
          )}
          {confirmationPinFilled && !pinsMatch && (
            <SSVStack itemsCenter gap="sm">
              <SSIconCircleXThin height={40} width={40} />
              <SSText uppercase size="lg" color="muted" center>
                {i18n.t('auth.pinsDontMatch')}
              </SSText>
            </SSVStack>
          )}
        </SSVStack>
        <SSVStack widthFull>
          {stage === 'set' && pinFilled && (
            <SSButton
              label={i18n.t('auth.confirm')}
              variant="secondary"
              onPress={() => handleConfirmPin()}
            />
          )}
          {stage === 're-enter' && confirmationPinFilled && pinsMatch && (
            <SSButton
              label={i18n.t('auth.set')}
              variant="secondary"
              loading={loading}
              onPress={() => handleSetPin()}
            />
          )}
          {stage === 'set' && !pinFilled && (
            <SSButton
              label={i18n.t('auth.setLater')}
              variant="ghost"
              onPress={() => handleSetPinLater()}
            />
          )}
          {stage === 'set' && pinFilled && (
            <SSButton
              label={i18n.t('common.clear')}
              variant="ghost"
              onPress={() => clearPin()}
            />
          )}
          {stage === 're-enter' && !confirmationPinFilled && (
            <SSButton
              label={i18n.t('common.goBack')}
              variant="ghost"
              onPress={() => handleGoBack()}
            />
          )}
          {stage === 're-enter' && confirmationPinFilled && (
            <SSButton
              label={i18n.t('common.clear')}
              variant="ghost"
              onPress={() => clearConfirmationPin()}
            />
          )}
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
