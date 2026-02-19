import type { Dispatch, SetStateAction } from 'react'
import Animated from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAuthStore } from '@/store/auth'
import { error, gray, warning } from '@/styles/colors'

type SSPinEntryProps = {
  pin: string[]
  setPin: Dispatch<SetStateAction<string[]>>
  onFillEnded: (pin: string) => void
  autoFocus?: boolean
  title?: string
}

function SSPinEntry({
  pin,
  setPin,
  onFillEnded,
  autoFocus = true,
  title = t('auth.unlock')
}: SSPinEntryProps) {
  const [pinTries, pinMaxTries] = useAuthStore(
    useShallow((state) => [state.pinTries, state.pinMaxTries])
  )
  const { shakeStyle } = useAnimatedShake()
  const triesLeft = pinMaxTries - pinTries

  function getTextColor() {
    if (triesLeft > 2) return gray[200]
    if (triesLeft === 1) return error
    if (triesLeft === 2) return warning
    return undefined
  }

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
            autoFocus={autoFocus}
            onFillEnded={onFillEnded}
          />
        </Animated.View>
        {triesLeft !== pinMaxTries && (
          <SSVStack gap="xxs" itemsCenter>
            <SSText
              uppercase
              center
              color={triesLeft > 2 ? 'muted' : undefined}
              style={{ color: getTextColor() }}
            >
              {triesLeft}{' '}
              {triesLeft > 1 ? t('auth.triesLeft') : t('auth.tryLeft')}
            </SSText>
            {triesLeft <= 2 && (
              <SSText
                uppercase
                center
                size="sm"
                style={{ color: getTextColor() }}
              >
                {t('auth.warningKeysErase')}
              </SSText>
            )}
          </SSVStack>
        )}
      </SSVStack>
    </SSVStack>
  )
}

export default SSPinEntry
