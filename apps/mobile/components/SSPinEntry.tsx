import type { Dispatch, SetStateAction } from 'react'
import Animated from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAuthStore } from '@/store/auth'

type SSPinEntryProps = {
  pin: string[]
  setPin: Dispatch<SetStateAction<string[]>>
  onFillEnded: (pin: string) => void
  title?: string
}

function SSPinEntry({
  pin,
  setPin,
  onFillEnded,
  title = t('auth.unlock')
}: SSPinEntryProps) {
  const [pinTries, pinMaxTries] = useAuthStore(
    useShallow((state) => [state.pinTries, state.pinMaxTries])
  )
  const { shakeStyle } = useAnimatedShake()
  const triesLeft = pinMaxTries - pinTries

  return (
    <SSVStack itemsCenter justifyBetween style={{ height: '100%' }}>
      <SSVStack gap="lg" itemsCenter style={{ marginTop: '25%' }}>
        <SSText uppercase size="lg" color="muted" center>
          {title}
        </SSText>
        <Animated.View style={shakeStyle}>
          <SSPinInput
            pin={pin}
            setPin={setPin}
            autoFocus
            onFillEnded={onFillEnded}
          />
        </Animated.View>
        {triesLeft !== pinMaxTries && (
          <SSText uppercase color="muted" center>
            {triesLeft}{' '}
            {triesLeft > 1 ? t('auth.triesLeft') : t('auth.tryLeft')}
          </SSText>
        )}
      </SSVStack>
    </SSVStack>
  )
}

export default SSPinEntry
