import { useState } from 'react'
import Animated from 'react-native-reanimated'
import { toast } from 'sonner-native'

import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { PIN_KEY, SALT_KEY } from '@/config/auth'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import SSVStack from '@/layouts/SSVStack'
import { getItem } from '@/storage/encrypted'
import { gray } from '@/styles/colors'
import { pbkdf2Encrypt } from '@/utils/crypto'
import { emptyPin } from '@/utils/pin'

type SSPinAuthProps = {
  title?: string
  onFail: () => void
  onSuccess: () => void
}

function SSPinAuth({ title, onFail, onSuccess }: SSPinAuthProps) {
  const { shakeStyle } = useAnimatedShake()
  const [pin, setPin] = useState<string[]>(emptyPin())

  async function handleFillEnded(inputPin: string) {
    const hashedPin = await getItem(PIN_KEY)
    const salt = await getItem(SALT_KEY)
    if (!hashedPin || !salt) {
      toast.error('Failed to retrieve PIN for authentication')
      return
    }
    const hashedInput = await pbkdf2Encrypt(inputPin, salt)
    if (hashedInput === hashedPin) {
      onSuccess()
    } else {
      setPin(emptyPin())
      onFail()
    }
  }

  return (
    <SSVStack
      itemsCenter
      gap={title ? 'lg' : 'none'}
      style={{ flex: 1, width: '100%' }}
    >
      {title ? (
        <SSText
          uppercase
          size="lg"
          color="muted"
          center
          style={{ color: gray[300] }}
        >
          {title}
        </SSText>
      ) : null}
      <Animated.View style={[{ flex: 1, width: '100%' }, shakeStyle]}>
        <SSPinInput pin={pin} setPin={setPin} onFillEnded={handleFillEnded} />
      </Animated.View>
    </SSVStack>
  )
}

export default SSPinAuth
