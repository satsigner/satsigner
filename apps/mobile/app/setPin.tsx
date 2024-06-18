import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState } from 'react'

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

export default function Init() {
  const router = useRouter()
  const authStore = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>('set')

  const [pin, setPin] = useState<string[]>(Array(PIN_SIZE).fill(''))
  const [confirmationPin, setConfirmationPin] = useState<string[]>(
    Array(PIN_SIZE).fill('')
  )

  const pinFilled = pin.findIndex((text) => text === '') === -1
  const confirmationPinFilled =
    confirmationPin.findIndex((text) => text === '') === -1
  const pinsMatch = pin.join('') === confirmationPin.join('')

  function handleSetPinLater() {
    authStore.setFirstTime(false)
    router.replace('/')
  }

  async function handleConfirmPin() {
    setStage('re-enter')
  }

  function clearPin() {
    setPin(Array(PIN_SIZE).fill(''))
  }

  function clearConfirmationPin() {
    setConfirmationPin(Array(PIN_SIZE).fill(''))
  }

  async function handleSetPin() {
    if (pin.join('') !== confirmationPin.join('')) return
    setLoading(true)
    await authStore.setPin(pin.join(''))
    setLoading(false)
    router.replace('/')
    authStore.setFirstTime(false)
    authStore.setRequiresAuth(true)
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
          <SSVStack style={{ gap: -8 }}>
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
          {stage === 'set' && <SSPinInput pin={pin} setPin={setPin} />}
          {stage === 're-enter' && (
            <SSPinInput pin={confirmationPin} setPin={setConfirmationPin} />
          )}
          {confirmationPinFilled && pinsMatch && (
            <SSVStack itemsCenter gap="sm">
              <Image
                style={{ width: 40, height: 40 }}
                source={require('@/assets/icons/check-circle-thin.svg')}
              />
              <SSText uppercase size="lg" color="muted" center>
                {i18n.t('auth.pinsMatch')}
              </SSText>
            </SSVStack>
          )}
          {confirmationPinFilled && !pinsMatch && (
            <SSVStack itemsCenter gap="sm">
              <Image
                style={{ width: 40, height: 40 }}
                source={require('@/assets/icons/circle-x-thin.svg')}
              />
              <SSText uppercase size="lg" color="muted" center>
                {i18n.t('auth.pinsDontMatch')}
              </SSText>
            </SSVStack>
          )}
        </SSVStack>
        <SSVStack style={{ width: '100%' }}>
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
