// Most of the gesture code is from
// https://github.com/likashefqet/react-native-image-zoom
// with a few modifications to work with Skia and focal points pinching improvements

import { useCallback, useRef } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withTiming
} from 'react-native-reanimated'

import {
  ANIMATION_VALUE,
  type OnPanEndCallback,
  type OnPanStartCallback,
  type OnPinchEndCallback,
  type OnPinchStartCallback,
  ZOOM_TYPE,
  type ZoomUseGesturesProps
} from '@/types/ui/gestures'
import { clamp, limits, sum } from '@/utils/worklet'

import { useAnimationEnd } from './useAnimationEnd'
import { useInteractionId } from './useInteractionId'
import { usePanGestureCount } from './usePanGestureCount'

export const useGestures = ({
  width,
  height,
  center,
  minScale = 1,
  maxScale = 5,
  doubleTapScale = 3,
  minPanPointers = 2,
  maxPanPointers = 2,
  isPanEnabled = true,
  isPinchEnabled = true,
  isDoubleTapEnabled = false,
  onInteractionStart,
  onInteractionEnd,
  onPinchStart,
  onPinchEnd,
  onPanStart,
  onPanEnd,
  onDoubleTap = () => {}
}: ZoomUseGesturesProps) => {
  const isInteracting = useRef(false)
  const isPinching = useRef(false)
  const { isPanning, startPan, endPan } = usePanGestureCount()

  const savedScale = useSharedValue(1)
  const scale = useSharedValue(1)
  const initialFocal = { x: useSharedValue(0), y: useSharedValue(0) }
  const savedFocal = { x: useSharedValue(0), y: useSharedValue(0) }
  const focal = { x: useSharedValue(0), y: useSharedValue(0) }
  const savedTranslate = { x: useSharedValue(0), y: useSharedValue(0) }
  const translate = { x: useSharedValue(0), y: useSharedValue(0) }
  const isDescriptionVisible = useSharedValue(false)

  const { getInteractionId, updateInteractionId } = useInteractionId()
  const { onAnimationEnd } = useAnimationEnd()

  const moveIntoView = () => {
    'worklet'
    if (scale.value > 1) {
      const rightLimit = limits.right(width, scale)
      const leftLimit = -rightLimit
      const bottomLimit = limits.bottom(height, scale)
      const topLimit = -bottomLimit
      const totalTranslateX = sum(translate.x, focal.x)
      const totalTranslateY = sum(translate.y, focal.y)

      if (totalTranslateX > rightLimit) {
        translate.x.value = withTiming(rightLimit)
        focal.x.value = withTiming(0)
      } else if (totalTranslateX < leftLimit) {
        translate.x.value = withTiming(leftLimit)
        focal.x.value = withTiming(0)
      }

      if (totalTranslateY > bottomLimit) {
        translate.y.value = withTiming(bottomLimit)
        focal.y.value = withTiming(0)
      } else if (totalTranslateY < topLimit) {
        translate.y.value = withTiming(topLimit)
        focal.y.value = withTiming(0)
      }
    } else {
      reset()
    }
  }

  const reset = useCallback(() => {
    'worklet'
    const interactionId = getInteractionId()

    savedScale.value = 1
    scale.value = withTiming(1, undefined, (...args) =>
      onAnimationEnd(interactionId, ANIMATION_VALUE.SCALE, ...args)
    )
    initialFocal.x.value = 0
    initialFocal.y.value = 0
    savedFocal.x.value = 0
    savedFocal.y.value = 0
    focal.x.value = withTiming(0, undefined, (...args) =>
      onAnimationEnd(interactionId, ANIMATION_VALUE.FOCAL_X, ...args)
    )
    focal.y.value = withTiming(0, undefined, (...args) =>
      onAnimationEnd(interactionId, ANIMATION_VALUE.FOCAL_Y, ...args)
    )
    savedTranslate.x.value = 0
    savedTranslate.y.value = 0
    translate.x.value = withTiming(0, undefined, (...args) =>
      onAnimationEnd(interactionId, ANIMATION_VALUE.TRANSLATE_X, ...args)
    )
    translate.y.value = withTiming(0, undefined, (...args) =>
      onAnimationEnd(interactionId, ANIMATION_VALUE.TRANSLATE_Y, ...args)
    )
  }, [
    savedScale,
    scale,
    initialFocal.x,
    initialFocal.y,
    savedFocal.x,
    savedFocal.y,
    focal.x,
    focal.y,
    savedTranslate.x,
    savedTranslate.y,
    translate.x,
    translate.y,
    getInteractionId,
    onAnimationEnd
  ])

  const onInteractionStarted = () => {
    if (!isInteracting.current) {
      isInteracting.current = true
      onInteractionStart?.()
      updateInteractionId()
    }
  }

  const onInteractionEnded = () => {
    if (isInteracting.current && !isPinching.current && !isPanning()) {
      if (isDoubleTapEnabled) {
        moveIntoView()
      } else {
        reset()
      }
      isInteracting.current = false
      onInteractionEnd?.()
    }
  }

  const onPinchStarted: OnPinchStartCallback = (event) => {
    onInteractionStarted()
    isPinching.current = true
    initialFocal.x.value = event.focalX
    initialFocal.y.value = event.focalY
    onPinchStart?.(event)
  }

  const onPinchEnded: OnPinchEndCallback = (...args) => {
    isPinching.current = false
    onPinchEnd?.(...args)
    onInteractionEnded()
  }

  const onPanStarted: OnPanStartCallback = (event) => {
    onInteractionStarted()
    startPan()
    onPanStart?.(event)
  }

  const onPanEnded: OnPanEndCallback = (...args) => {
    endPan()
    onPanEnd?.(...args)
    onInteractionEnded()
  }

  // Define the pan gesture configuration
  const panGesture = Gesture.Pan()
    .enabled(isPanEnabled) // Enable or disable the pan gesture based on isPanEnabled
    .minPointers(minPanPointers) // Set the minimum number of pointers required to recognize the gesture
    .maxPointers(maxPanPointers) // Set the maximum number of pointers allowed
    .onStart((event) => {
      runOnJS(onPanStarted)(event) // Call the onPanStarted function when the pan starts
      savedTranslate.x.value = translate.x.value // Save the current x translation
      savedTranslate.y.value = translate.y.value // Save the current y translation
    })
    .onUpdate((event) => {
      // Update the translation values based on the pan movement
      translate.x.value = savedTranslate.x.value + event.translationX
      translate.y.value = savedTranslate.y.value + event.translationY
    })
    .onEnd((event, success) => {
      // Calculate the limits for translation based on the current scale
      const rightLimit = limits.right(width, scale)
      const leftLimit = -rightLimit
      const bottomLimit = limits.bottom(height, scale)
      const topLimit = -bottomLimit

      // Apply decay to the translation values if the scale is greater than 1
      if (scale.value > 1) {
        translate.x.value = withDecay(
          {
            velocity: event.velocityX * 0.6, // Apply decay based on the x velocity
            rubberBandEffect: true, // Enable rubber band effect
            rubberBandFactor: 0.9, // Set rubber band factor
            clamp: [leftLimit - focal.x.value, rightLimit - focal.x.value] // Clamp values to prevent excessive movement
          },
          () => {
            // End the pan gesture if the x velocity is greater than or equal to the y velocity
            if (event.velocityX >= event.velocityY) {
              runOnJS(onPanEnded)(event, success)
            }
          }
        )
        translate.y.value = withDecay(
          {
            velocity: event.velocityY * 0.6, // Apply decay based on the y velocity
            rubberBandEffect: true, // Enable rubber band effect
            rubberBandFactor: 0.9, // Set rubber band factor
            clamp: [topLimit - focal.y.value, bottomLimit - focal.y.value] // Clamp values to prevent excessive movement
          },
          () => {
            // End the pan gesture if the y velocity is greater than the x velocity
            if (event.velocityY > event.velocityX) {
              runOnJS(onPanEnded)(event, success)
            }
          }
        )
      } else {
        // End the pan gesture immediately if the scale is not greater than 1
        runOnJS(onPanEnded)(event, success)
      }
    })

  // Define the pinch gesture handler
  const pinchGesture = Gesture.Pinch()
    .enabled(isPinchEnabled) // Enable pinch gesture based on isPinchEnabled flag
    .onStart((event) => {
      runOnJS(onPinchStarted)(event) // Trigger the pinch start event
      // Save the initial scale and focal points
      savedScale.value = scale.value
      savedFocal.x.value = focal.x.value
      savedFocal.y.value = focal.y.value
      // Record the initial focal points from the event
      initialFocal.x.value = event.focalX
      initialFocal.y.value = event.focalY
    })
    .onUpdate((event) => {
      // Update the scale within allowed limits
      scale.value = clamp(savedScale.value * event.scale, minScale, maxScale)
      // Calculate the scale change ratio
      const scaleChangeScale =
        (scale.value - savedScale.value) / savedScale.value
      // Compute the offsets for focal points
      const centerOffsetX =
        savedFocal.x.value + translate.x.value + center.x - initialFocal.x.value
      const centerOffsetY =
        savedFocal.y.value + translate.y.value + center.y - initialFocal.y.value
      // Adjust focal points based on the scale change
      focal.x.value = centerOffsetX * scaleChangeScale + savedFocal.x.value
      focal.y.value = centerOffsetY * scaleChangeScale + savedFocal.y.value
    })
    .onEnd((...args) => {
      isDescriptionVisible.value = args[0].scale > 1
      runOnJS(onPinchEnded)(...args) // Trigger the pinch end event
    })

  const doubleTapGesture = Gesture.Tap()
    .enabled(isDoubleTapEnabled)
    .numberOfTaps(2)
    .maxDuration(250)
    .onStart((event) => {
      if (scale.value === 1) {
        isDescriptionVisible.value = true
        runOnJS(onDoubleTap)(ZOOM_TYPE.ZOOM_IN)
        scale.value = withTiming(doubleTapScale)
        focal.x.value = withTiming((center.x - event.x) * (doubleTapScale - 1))
        focal.y.value = withTiming((center.y - event.y) * (doubleTapScale - 1))
      } else {
        isDescriptionVisible.value = false
        runOnJS(onDoubleTap)(ZOOM_TYPE.ZOOM_OUT)
        reset()
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translate.y.value },
      { translateX: translate.x.value },
      { translateY: focal.y.value },
      { translateX: focal.x.value },
      { scale: scale.value }
    ]
  }))

  const descriptionOpacity = useDerivedValue(() => {
    return withTiming(isDescriptionVisible.value ? 1 : 0, {
      duration: 200
    })
  })

  const transform = useDerivedValue(() => [
    { translateY: translate.y.value },
    { translateX: translate.x.value },
    { translateY: focal.y.value },
    { translateX: focal.x.value },
    { scale: scale.value }
  ])

  const gestures = Gesture.Simultaneous(
    doubleTapGesture,
    pinchGesture,
    panGesture
  )

  return { gestures, animatedStyle, reset, transform, descriptionOpacity }
}
