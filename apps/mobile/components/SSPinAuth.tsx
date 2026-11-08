import { Pressable } from 'react-native'
import Animated from 'react-native-reanimated'

import SSPinInput, { type SSPinInputProps } from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import { type UsePinAuthProps, usePinAuth } from '@/hooks/usePinAuth'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { gray } from '@/styles/colors'

type SSPinAuthProps = UsePinAuthProps & {
  onTitlePress?: () => void
  title?: string
} & Pick<SSPinInputProps, 'feedbackBold' | 'feedbackColor' | 'feedbackText'>

function SSPinAuth({
  onTitlePress,
  title,
  onSuccess,
  onTriesOver,
  maxTries,
  ...props
}: SSPinAuthProps) {
  const { pin, verifying, handleFillEnded, setPin } = usePinAuth({
    maxTries,
    onSuccess,
    onTriesOver
  })
  const { shakeStyle } = useAnimatedShake()

  const titleText = (
    <SSText
      uppercase
      size="lg"
      color="muted"
      center
      style={{ color: gray[300] }}
    >
      {verifying ? t('auth.unlocking') : title}
    </SSText>
  )

  return (
    <SSVStack
      itemsCenter
      gap={title ? 'lg' : 'none'}
      style={{ flex: 1, width: '100%' }}
    >
      {title && onTitlePress && (
        <Pressable onPress={onTitlePress}>{titleText}</Pressable>
      )}
      {title && !onTitlePress && titleText}
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
