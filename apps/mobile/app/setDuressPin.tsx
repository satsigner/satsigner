import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Platform } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCheckCircleThin, SSIconCircleXThin } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DURESS_PIN_KEY, PIN_KEY, PIN_SIZE, SALT_KEY } from '@/config/auth'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem, setItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { Layout } from '@/styles'
import { pbkdf2Encrypt } from '@/utils/crypto'

type Stage = 'set' | 're-enter'

export default function SetPin() {
  const router = useRouter()
  const [setFirstTime, setRequiresAuth] = useAuthStore(
    useShallow((state) => [state.setFirstTime, state.setRequiresAuth])
  )
  const showWarning = useSettingsStore((state) => state.showWarning)

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

  async function setPin(pin: string): Promise<boolean> {
    const salt = await getItem(SALT_KEY)
    const encryptedPin = await getItem(PIN_KEY)
    if (!salt || !encryptedPin) {
      toast.error('Normal PIN must be set before setting Duress PIN')
      return false
    }
    const encryptedDuressPin = await pbkdf2Encrypt(pin, salt)
    if (encryptedPin === encryptedDuressPin) {
      toast.error(t('auth.pinMatchDuressPin'))
      handleGoBack()
      return false
    }
    await setItem(DURESS_PIN_KEY, encryptedDuressPin)
    return true
  }

  async function handleSetPinLater() {
    if (showWarning) router.push('./warning')
    else router.replace('/')
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
    const isPinSet = await setPin(pinArray.join(''))
    setLoading(false)

    if (!isPinSet) return

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
                ? t('auth.setDuressPinTitle')
                : t('auth.reenterDuressPinTitle')}
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
          {stage === 'set' && pinFilled && (
            <SSButton
              label={t('auth.confirmDuressPin')}
              variant="secondary"
              onPress={() => handleConfirmPin()}
            />
          )}
          {stage === 're-enter' && confirmationPinFilled && pinsMatch && (
            <SSButton
              label={t('auth.setDuressPin')}
              variant="secondary"
              loading={loading}
              onPress={() => handleSetPin()}
            />
          )}
          {stage === 'set' && !pinFilled && (
            <SSButton
              label={t('auth.setDuressPinLater')}
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
