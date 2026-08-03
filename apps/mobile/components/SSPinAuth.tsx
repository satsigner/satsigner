import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import Animated from 'react-native-reanimated'
import { toast } from 'sonner-native'

import SSPinInput, { type SSPinInputProps } from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DURESS_PIN_KEY, SALT_KEY } from '@/config/auth'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import SSVStack from '@/layouts/SSVStack'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { gray } from '@/styles/colors'
import { getPin, pbkdf2Encrypt } from '@/utils/crypto'
import { emptyPin } from '@/utils/pin'
import { secureWipeAllWalletData } from '@/utils/secureWipe'

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
  const duressPinEnabled = useAuthStore((state) => state.duressPinEnabled)
  const [pin, setPin] = useState<string[]>(emptyPin())
  const [tries, setTries] = useState(0)
  const { shakeStyle } = useAnimatedShake()

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
    if (!hashedPin || !salt) {
      toast.error('Failed to retrieve PIN for authentication')
      return
    }
    const hashedInput = await pbkdf2Encrypt(inputPin, salt)

    // DURESS PIN — wipe secrets/stores so the duress PIN appears as the real PIN.
    if (duressPinEnabled && hashedInput === hashedDuressPin) {
      await secureWipeAllWalletData()
      router.dismissAll()
      router.push('/')
      return
    }

    // Upon failure, the pin reset is already done here
    if (hashedInput !== hashedPin) {
      setPin(emptyPin())

      // max tries logic
      const newTries = tries + 1
      setTries(newTries)
      if (maxTries && newTries >= maxTries && onTriesOver) {
        onTriesOver()
      }

      // The fail callback could be show a warning, dismiss a modal, etc...
      if (onFail) {
        onFail()
      }
      return
    }

    // The success callback could be unlock the app, or view mnemonic, or confirm wallet deletion
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
