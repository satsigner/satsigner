import { Pressable } from 'react-native'
import type { PressableProps, StyleProp, ViewStyle } from 'react-native'

const DEFAULT_ACTIVE_OPACITY = 0.2

// Long enough for a list scroll to claim the touch before a row dims.
export const LIST_ITEM_PRESS_DELAY_MS = 100

type SSPressableProps = Omit<PressableProps, 'style'> & {
  activeOpacity?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Pressable that dims to `activeOpacity` while pressed, like TouchableOpacity.
 * Use it wherever a tap target needs opacity feedback.
 */
function SSPressable({
  activeOpacity = DEFAULT_ACTIVE_OPACITY,
  style,
  ...props
}: SSPressableProps) {
  return (
    <Pressable
      style={({ pressed }) => [style, pressed && { opacity: activeOpacity }]}
      {...props}
    />
  )
}

export default SSPressable
