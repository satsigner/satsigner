import {
  useAnimatedStyle,
  useDerivedValue,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated'

const SCALE_DEFAULT = 1
const SCALE_POP = 1.14
const ACTIVE_OPACITY = 1
const INACTIVE_OPACITY = 0.55
const OPACITY_DURATION = 180
const POP_DURATION = 70
const SPRING_DAMPING = 14
const SPRING_MASS = 0.4
const SPRING_STIFFNESS = 280

export function useTabBarButtonAnimation(isSelected: boolean) {
  const scale = useDerivedValue(() =>
    isSelected
      ? withSequence(
          withTiming(SCALE_POP, { duration: POP_DURATION }),
          withSpring(SCALE_DEFAULT, {
            damping: SPRING_DAMPING,
            mass: SPRING_MASS,
            stiffness: SPRING_STIFFNESS
          })
        )
      : SCALE_DEFAULT
  )
  const opacity = useDerivedValue(() =>
    withTiming(isSelected ? ACTIVE_OPACITY : INACTIVE_OPACITY, {
      duration: OPACITY_DURATION
    })
  )

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }))
}
