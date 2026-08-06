import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import Animated from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSPinInput, { type SSPinInputProps } from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DURESS_PIN_KEY, SALT_KEY, SALT_KEY_DURESS } from '@/config/auth'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import { useSecureWipe } from '@/hooks/useSecureWipe'
import SSVStack from '@/layouts/SSVStack'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { gray } from '@/styles/colors'
import { pbkdf2Encrypt } from '@/utils/crypto'
import { emptyPin, getPin } from '@/utils/pin'

type SSPinAuthProps = {
  onFail?: () => void
  onSuccess: () => void
  onTriesOver?: () => void
  maxTries?: number
  resetPin?: boolean
  title?: string
} & Pick<SSPinInputProps, 'feedbackBold' | 'feedbackColor' | 'feedbackText'>

function SSPinAuth({
  title,
  onFail,
  onSuccess,
  onTriesOver,
  maxTries,
  resetPin,
  ...props
}: SSPinAuthProps) {
  const [duressPinEnabled, setLockTriggered, setJustUnlocked, resetPinTries] =
    useAuthStore(
      useShallow((state) => [
        state.duressPinEnabled,
        state.setLockTriggered,
        state.setJustUnlocked,
        state.resetPinTries
      ])
    )
  const [pin, setPin] = useState<string[]>(emptyPin())
  const [tries, setTries] = useState(0)
  const { shakeStyle } = useAnimatedShake()
  const secureWipe = useSecureWipe()

  useEffect(() => {
    if (resetPin === true) {
      setPin(emptyPin())
      setTries(0)
    }
  }, [resetPin])

  async function handleFillEnded(inputPin: string) {
    const hashedPin = await getPin()
    const hashedDuressPin = await getItem(DURESS_PIN_KEY)
    const salt = await getItem(SALT_KEY)
    const saltDuress = await getItem(SALT_KEY_DURESS)
    if (!hashedPin || !salt) {
      toast.error('Failed to retrieve PIN for authentication')
      return
    }

    const hashedInput = await pbkdf2Encrypt(inputPin, salt)
    const hashedInputDuress = saltDuress
      ? await pbkdf2Encrypt(inputPin, saltDuress)
      : ''

    // DURESS PIN
    if (duressPinEnabled && hashedInputDuress === hashedDuressPin) {
      try {
        await secureWipe()
      } catch {
        // Duress wipe is best-effort; always proceed to unlock the app.
      }
      setLockTriggered(false)
      setJustUnlocked(true)
      resetPinTries()
      router.dismissAll()
      router.push('/')
      return
    }

    // Upon failure, the reset of local pin state is done here
    if (hashedInput !== hashedPin) {
      setPin(emptyPin())
      const newTries = tries + 1
      setTries(newTries)
      if (maxTries && newTries >= maxTries && onTriesOver) {
        onTriesOver()
      }

      // the fail callback could be show a warning, dismiss a modal, etc...
      if (onFail) {
        onFail()
      }
      return
    }

    // the success callback could be unlock the app, or view mnemonic, or confirm wallet deletion
    onSuccess()
  }

  return (
    <SSVStack
      itemsCenter
      gap={title ? 'lg' : 'none'}
      style={{ flex: 1, width: '100%' }}
    >
      {title && (
        <SSText
          uppercase
          size="lg"
          color="muted"
          center
          style={{ color: gray[300] }}
        >
          {title}
        </SSText>
      )}
      <Animated.View style={[{ flex: 1, width: '100%' }, shakeStyle]}>
        <SSPinInput
          pin={pin}
          setPin={setPin}
          onFillEnded={handleFillEnded}
          {...props}
        />
      </Animated.View>
    </SSVStack>
  )
}

export default SSPinAuth
