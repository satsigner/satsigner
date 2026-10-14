import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from 'react-native'

const DEFAULT_ACTIVE_OPACITY = 0.2

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
