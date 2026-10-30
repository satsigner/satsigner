import { useCallback } from 'react'
import {
  type AnimatableValue,
  type AnimationCallback,
  runOnJS,
  useSharedValue
} from 'react-native-reanimated'

import {
  ANIMATION_VALUE,
  type OnResetAnimationEndCallback
} from '@/types/ui/gestures'

type OnAnimationEndCallback = AnimationCallback extends (
  ...a: infer I
) => infer O
  ? (interactionId: string, value: ANIMATION_VALUE, ...a: I) => O
  : never

type EndValues = Record<
  ANIMATION_VALUE,
  {
    finished?: boolean
    current?: AnimatableValue
  }
>
type PartialEndValues = Partial<EndValues>
type InteractionEndValues = Record<string, PartialEndValues>

const ANIMATION_VALUES = [
  ANIMATION_VALUE.SCALE,
  ANIMATION_VALUE.FOCAL_X,
  ANIMATION_VALUE.FOCAL_Y,
  ANIMATION_VALUE.TRANSLATE_X,
  ANIMATION_VALUE.TRANSLATE_Y
]

const isAnimationComplete = (
  endValues: PartialEndValues
): endValues is EndValues => ANIMATION_VALUES.every((item) => !!endValues[item])

// Kept outside the hook: React Compiler would hoist the inner callback out of
// the worklet into a plain function the UI runtime cannot call.
function areAllAnimationsFinished(endValues: EndValues) {
  'worklet'
  return !Object.values(endValues).some((item) => !item.finished)
}

export const useAnimationEnd = (
  onResetAnimationEnd?: OnResetAnimationEndCallback
) => {
  const endValues = useSharedValue<InteractionEndValues>({})

  const onAnimationEnd: OnAnimationEndCallback = useCallback(
    (interactionId, value, finished, current) => {
      'worklet'
      if (onResetAnimationEnd) {
        const interactionEndValues = endValues.get()
        const currentEndValues = interactionEndValues[interactionId] || {}
        currentEndValues[value] = { current, finished }
        if (isAnimationComplete(currentEndValues)) {
          const completed = areAllAnimationsFinished(currentEndValues)
          runOnJS(onResetAnimationEnd)(completed, currentEndValues)
          delete interactionEndValues[interactionId]
        } else {
          interactionEndValues[interactionId] = currentEndValues
        }
      }
    },
    [onResetAnimationEnd, endValues]
  )

  return { onAnimationEnd }
}
