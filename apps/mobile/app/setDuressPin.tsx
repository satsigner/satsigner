import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCheckCircleThin, SSIconCircleXThin } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DURESS_PIN_KEY, PIN_KEY, SALT_KEY } from '@/config/auth'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem, setItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { Layout } from '@/styles'
import { pbkdf2Encrypt } from '@/utils/crypto'
import { emptyPin } from '@/utils/pin'

type Stage = 'set' | 're-enter'

export default function SetPin() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [setFirstTime, setRequiresAuth] = useAuthStore(
    useShallow((state) => [state.setFirstTime, state.setRequiresAuth])
  )
  const showWarning = useSettingsStore((state) => state.showWarning)

  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>('set')

  const [pinArray, setPinArray] = useState<string[]>(emptyPin)
  const [confirmationPinArray, setConfirmationPinArray] =
    useState<string[]>(emptyPin)

  const pinFilled = !pinArray.includes('')
  const confirmationPinFilled = !confirmationPinArray.includes('')
  const pinsMatch = pinArray.join('') === confirmationPinArray.join('')

  async function setPin(pin: string) {
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

  function handleSetPinLater() {
    if (showWarning) {
      router.push('./warning')
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
    const isPinSet = await setPin(pinArray.join(''))
    setLoading(false)

    if (!isPinSet) {
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
    if (stage === 'set') {
      return t('auth.setDuressPinTitle')
    }
    return t('auth.reenterDuressPinTitle')
  }

  function getFeedback() {
    if (!confirmationPinFilled) {
      return null
    }
    if (pinsMatch) {
      return (
        <SSVStack itemsCenter gap="xs">
          <SSIconCheckCircleThin height={32} width={32} />
          <SSText uppercase size="lg" color="muted" center>
            {t('auth.pinsMatch')}
          </SSText>
        </SSVStack>
      )
    }
    return (
      <SSVStack itemsCenter gap="xs">
        <SSIconCircleXThin height={32} width={32} />
        <SSText uppercase size="lg" color="muted" center>
          {t('auth.pinsDontMatch')}
        </SSText>
      </SSVStack>
    )
  }

  return (
    <SSMainLayout
      style={{
        paddingBottom: Math.max(
          Layout.mainContainer.paddingBottom,
          insets.bottom + 16
        ),
        paddingTop: Math.max(Layout.mainContainer.paddingTop, insets.top + 32)
      }}
    >
      <SSVStack style={{ flex: 1 }} itemsCenter justifyBetween>
        <SSVStack gap="lg" style={{ flex: 1, width: '100%' }}>
          <SSVStack>
            <SSText uppercase size="lg" color="muted" center>
              {getTitle()}
            </SSText>
          </SSVStack>
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
