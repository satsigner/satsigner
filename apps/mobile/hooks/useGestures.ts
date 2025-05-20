// Most of the gesture code is from
// https://github.com/likashefqet/react-native-image-zoom
// with a few modifications to work with Skia and focal points pinching improvements

import { useCallback, useRef } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
  runOnJS,
  useAnimatedReaction,
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
  shouldResetOnInteractionEnd = true,
  onInteractionStart,
  onInteractionEnd,
  onPinchStart,
  onPinchEnd,
  onPanStart,
  onPanEnd,
  onDoubleTap = () => {},
  onSingleTap = () => {},
  initialTranslation = { x: 0, y: 0 }
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
  const translate = {
    x: useSharedValue(initialTranslation.x),
    y: useSharedValue(initialTranslation.y)
  }
  const isZoomedIn = useSharedValue(false)

  // Use useAnimatedReaction to update translation when initialTranslation prop changes
  useAnimatedReaction(
    () => {
      // Preparer function: runs on JS thread when dependencies change.
      // Returns the data to be watched.
      return { x: initialTranslation.x, y: initialTranslation.y }
    },
    (currentData) => {
      'worklet'
      // Reactor function: runs on UI thread if currentData is different from previousData.
      if (currentData) {
        // Update translate and savedTranslate shared values
        translate.x.value = currentData.x
        translate.y.value = currentData.y
        savedTranslate.x.value = currentData.x
        savedTranslate.y.value = currentData.y
      }
    },
    [initialTranslation.x, initialTranslation.y] // Dependencies for the preparer
  )

  const { getInteractionId, updateInteractionId } = useInteractionId()
  const { onAnimationEnd } = useAnimationEnd()

  const moveIntoView = () => {
    'worklet'
    if (scale.value > 1) {
      // Only apply boundary constraints if shouldResetOnInteractionEnd is true
      if (shouldResetOnInteractionEnd) {
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
      }
    } else if (shouldResetOnInteractionEnd) {
      reset()
    }
  }

  const resetScale = useCallback(() => {
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
  }, [
    savedScale,
    scale,
    initialFocal.x,
    initialFocal.y,
    savedFocal.x,
    savedFocal.y,
    focal.x,
    focal.y,
    getInteractionId,
    onAnimationEnd
  ])

  const reset = useCallback(() => {
    'worklet'
    const interactionId = getInteractionId()

    resetScale()
    savedTranslate.x.value = initialTranslation.x
    savedTranslate.y.value = initialTranslation.y
    translate.x.value = withTiming(initialTranslation.x, undefined, (...args) =>
      onAnimationEnd(interactionId, ANIMATION_VALUE.TRANSLATE_X, ...args)
    )
    translate.y.value = withTiming(initialTranslation.y, undefined, (...args) =>
      onAnimationEnd(interactionId, ANIMATION_VALUE.TRANSLATE_Y, ...args)
    )
  }, [
    resetScale,
    savedTranslate.x,
    savedTranslate.y,
    translate.x,
    translate.y,
    initialTranslation.x,
    initialTranslation.y,
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
      } else if (shouldResetOnInteractionEnd) {
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

      // When shouldResetOnInteractionEnd is false, apply decay regardless of scale
      if (!shouldResetOnInteractionEnd || scale.value > 1) {
        // For X translation
        if (shouldResetOnInteractionEnd && scale.value > 1) {
          // With boundaries when scale > 1
          translate.x.value = withDecay(
            {
              velocity: event.velocityX * 0.6,
              rubberBandEffect: true,
              rubberBandFactor: 0.9,
              clamp: [leftLimit - focal.x.value, rightLimit - focal.x.value]
            },
            () => {
              if (event.velocityX >= event.velocityY) {
                runOnJS(onPanEnded)(event, success)
              }
            }
          )
        } else {
          // Without boundaries
          translate.x.value = withDecay(
            {
              velocity: event.velocityX * 0.6
            },
            () => {
              if (event.velocityX >= event.velocityY) {
                runOnJS(onPanEnded)(event, success)
              }
            }
          )
        }

        // For Y translation
        if (shouldResetOnInteractionEnd && scale.value > 1) {
          // With boundaries when scale > 1
          translate.y.value = withDecay(
            {
              velocity: event.velocityY * 0.6,
              rubberBandEffect: true,
              rubberBandFactor: 0.9,
              clamp: [topLimit - focal.y.value, bottomLimit - focal.y.value]
            },
            () => {
              if (event.velocityY > event.velocityX) {
                runOnJS(onPanEnded)(event, success)
              }
            }
          )
        } else {
          // Without boundaries
          translate.y.value = withDecay(
            {
              velocity: event.velocityY * 0.6
            },
            () => {
              if (event.velocityY > event.velocityX) {
                runOnJS(onPanEnded)(event, success)
              }
            }
          )
        }
      } else {
        // End the pan gesture immediately if the scale is not greater than 1 and shouldResetOnInteractionEnd is true
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
      isZoomedIn.value = args[0].scale > 1
      runOnJS(onPinchEnded)(...args) // Trigger the pinch end event
    })

  const doubleTapGesture = Gesture.Tap()
    .enabled(isDoubleTapEnabled)
    .numberOfTaps(2)
    .maxDuration(250)
    .onStart((event) => {
      if (scale.value === 1) {
        isZoomedIn.value = true
        runOnJS(onDoubleTap)(ZOOM_TYPE.ZOOM_IN)
        scale.value = withTiming(doubleTapScale)
        // Always calculate focal point based on tap location
        const focalX = (center.x - event.x) * (doubleTapScale - 1)
        const focalY = (center.y - event.y) * (doubleTapScale - 1)

        if (shouldResetOnInteractionEnd) {
          focal.x.value = withTiming(focalX)
          focal.y.value = withTiming(focalY)
        } else {
          // Adjust focal point based on current position
          focal.x.value = withTiming(
            focalX + translate.x.value * (doubleTapScale - 1)
          )
          focal.y.value = withTiming(
            focalY + translate.y.value * (doubleTapScale - 1)
          )
        }
      } else {
        isZoomedIn.value = false
        runOnJS(onDoubleTap)(ZOOM_TYPE.ZOOM_OUT)
        // Always reset to initialTranslation when zooming out
        reset()
      }
    })

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onStart((event) => {
      runOnJS(onSingleTap)(event)
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

  const transform = useDerivedValue(() => [
    { translateY: translate.y.value },
    { translateX: translate.x.value },
    { translateY: focal.y.value },
    { translateX: focal.x.value },
    { scale: scale.value }
  ])

  const pinchPanGestures = Gesture.Simultaneous(pinchGesture, panGesture)
  const tapGestures = Gesture.Exclusive(doubleTapGesture, singleTapGesture)
  const gestures = Gesture.Race(tapGestures, pinchPanGestures)

  return {
    gestures,
    animatedStyle,
    reset,
    transform,
    isZoomedIn,
    scale
  }
}
