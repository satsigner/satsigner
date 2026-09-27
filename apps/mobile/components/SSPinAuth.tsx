import Animated from 'react-native-reanimated'

import SSPinInput, { type SSPinInputProps } from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import { usePinAuth } from '@/hooks/usePinAuth'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { gray } from '@/styles/colors'

type SSPinAuthProps = {
  onFail?: () => void
  onSuccess: () => void | Promise<void>
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
  const { pin, verifying, handleFillEnded, setPin } = usePinAuth({
    maxTries,
    onFail,
    onSuccess,
    onTriesOver,
    resetPin
  })
  const { shakeStyle } = useAnimatedShake()

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
          {verifying ? t('auth.unlocking') : title}
        </SSText>
      )}
      <Animated.View style={[{ flex: 1, width: '100%' }, shakeStyle]}>
        {pin !== null && !verifying && (
          <SSPinInput
            pin={pin}
            setPin={setPin}
            onFillEnded={handleFillEnded}
            {...props}
          />
        )}
      </Animated.View>
    </SSVStack>
  )
}

export default SSPinAuth
