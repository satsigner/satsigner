// Most of the gesture code is from
// https://github.com/likashefqet/react-native-image-zoom
// with a few modifications to work with Skia and focal points pinching improvements

import { Gesture } from 'react-native-gesture-handler'
import {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withTiming
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

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
import { useGestureInteractionFlags } from './useGestureInteractionFlags'
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
  onDoubleTap = () => undefined,
  onSingleTap = () => undefined,
  initialTranslation = { x: 0, y: 0 }
}: ZoomUseGesturesProps) => {
  const { isInteracting, isPinching, setInteracting, setPinching } =
    useGestureInteractionFlags()
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

  useAnimatedReaction(
    () => ({ x: initialTranslation.x, y: initialTranslation.y }),
    (currentData) => {
      'worklet'
      // Reactor function: runs on UI thread if currentData is different from previousData.
      if (currentData) {
        translate.x.set(currentData.x)
        translate.y.set(currentData.y)
        savedTranslate.x.set(currentData.x)
        savedTranslate.y.set(currentData.y)
      }
    },
    [initialTranslation.x, initialTranslation.y]
  )

  const { getInteractionId, updateInteractionId } = useInteractionId()
  const { onAnimationEnd } = useAnimationEnd()

  // JS-only (see onInteractionEnded); not a worklet so reset stays in closure.
  const moveIntoView = () => {
    if (scale.get() > 1) {
      if (shouldResetOnInteractionEnd) {
        const rightLimit = limits.right(width, scale)
        const leftLimit = -rightLimit
        const bottomLimit = limits.bottom(height, scale)
        const topLimit = -bottomLimit
        const totalTranslateX = sum(translate.x, focal.x)
        const totalTranslateY = sum(translate.y, focal.y)

        if (totalTranslateX > rightLimit) {
          translate.x.set(withTiming(rightLimit))
          focal.x.set(withTiming(0))
        } else if (totalTranslateX < leftLimit) {
          translate.x.set(withTiming(leftLimit))
          focal.x.set(withTiming(0))
        }

        if (totalTranslateY > bottomLimit) {
          translate.y.set(withTiming(bottomLimit))
          focal.y.set(withTiming(0))
        } else if (totalTranslateY < topLimit) {
          translate.y.set(withTiming(topLimit))
          focal.y.set(withTiming(0))
        }
      }
    } else if (shouldResetOnInteractionEnd) {
      reset()
    }
  }

  const resetScale = () => {
    'worklet'
    const interactionId = getInteractionId()

    savedScale.set(1)
    scale.set(
      withTiming(1, undefined, (...args) =>
        onAnimationEnd(interactionId, ANIMATION_VALUE.SCALE, ...args)
      )
    )
    initialFocal.x.set(0)
    initialFocal.y.set(0)
    savedFocal.x.set(0)
    savedFocal.y.set(0)
    focal.x.set(
      withTiming(0, undefined, (...args) =>
        onAnimationEnd(interactionId, ANIMATION_VALUE.FOCAL_X, ...args)
      )
    )
    focal.y.set(
      withTiming(0, undefined, (...args) =>
        onAnimationEnd(interactionId, ANIMATION_VALUE.FOCAL_Y, ...args)
      )
    )
  }

  const reset = () => {
    'worklet'
    const interactionId = getInteractionId()

    resetScale()
    savedTranslate.x.set(initialTranslation.x)
    savedTranslate.y.set(initialTranslation.y)
    translate.x.set(
      withTiming(initialTranslation.x, undefined, (...args) =>
        onAnimationEnd(interactionId, ANIMATION_VALUE.TRANSLATE_X, ...args)
      )
    )
    translate.y.set(
      withTiming(initialTranslation.y, undefined, (...args) =>
        onAnimationEnd(interactionId, ANIMATION_VALUE.TRANSLATE_Y, ...args)
      )
    )
  }

  const onInteractionStarted = () => {
    if (!isInteracting()) {
      setInteracting(true)
      onInteractionStart?.()
      updateInteractionId()
    }
  }

  const onInteractionEnded = () => {
    if (isInteracting() && !isPinching() && !isPanning()) {
      if (isDoubleTapEnabled) {
        moveIntoView()
      } else if (shouldResetOnInteractionEnd) {
        reset()
      }
      setInteracting(false)
      onInteractionEnd?.()
    }
  }

  const onPinchStarted: OnPinchStartCallback = (event) => {
    onInteractionStarted()
    setPinching(true)
    initialFocal.x.set(event.focalX)
    initialFocal.y.set(event.focalY)
    onPinchStart?.(event)
  }

  const onPinchEnded: OnPinchEndCallback = (...args) => {
    setPinching(false)
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

  const panGesture = Gesture.Pan()
    .enabled(isPanEnabled)
    .minPointers(minPanPointers)
    .maxPointers(maxPanPointers)
    .onStart((event) => {
      scheduleOnRN(onPanStarted, event)
      savedTranslate.x.set(translate.x.get())
      savedTranslate.y.set(translate.y.get())
    })
    .onUpdate((event) => {
      translate.x.set(savedTranslate.x.get() + event.translationX)
      translate.y.set(savedTranslate.y.get() + event.translationY)
    })
    .onEnd((event, success) => {
      const rightLimit = limits.right(width, scale)
      const leftLimit = -rightLimit
      const bottomLimit = limits.bottom(height, scale)
      const topLimit = -bottomLimit

      if (!shouldResetOnInteractionEnd || scale.get() > 1) {
        translate.x.set(
          shouldResetOnInteractionEnd && scale.get() > 1
            ? withDecay(
                {
                  clamp: [
                    leftLimit - focal.x.get(),
                    rightLimit - focal.x.get()
                  ],
                  rubberBandEffect: true,
                  rubberBandFactor: 0.9,
                  velocity: event.velocityX * 0.6
                },
                () => {
                  if (event.velocityX >= event.velocityY) {
                    scheduleOnRN(onPanEnded, event, success)
                  }
                }
              )
            : withDecay(
                {
                  velocity: event.velocityX * 0.6
                },
                () => {
                  if (event.velocityX >= event.velocityY) {
                    scheduleOnRN(onPanEnded, event, success)
                  }
                }
              )
        )

        translate.y.set(
          shouldResetOnInteractionEnd && scale.get() > 1
            ? withDecay(
                {
                  clamp: [
                    topLimit - focal.y.get(),
                    bottomLimit - focal.y.get()
                  ],
                  rubberBandEffect: true,
                  rubberBandFactor: 0.9,
                  velocity: event.velocityY * 0.6
                },
                () => {
                  if (event.velocityY > event.velocityX) {
                    scheduleOnRN(onPanEnded, event, success)
                  }
                }
              )
            : withDecay(
                {
                  velocity: event.velocityY * 0.6
                },
                () => {
                  if (event.velocityY > event.velocityX) {
                    scheduleOnRN(onPanEnded, event, success)
                  }
                }
              )
        )
      } else {
        scheduleOnRN(onPanEnded, event, success)
      }
    })

  const pinchGesture = Gesture.Pinch()
    .enabled(isPinchEnabled)
    .onStart((event) => {
      scheduleOnRN(onPinchStarted, event)
      savedScale.set(scale.get())
      savedFocal.x.set(focal.x.get())
      savedFocal.y.set(focal.y.get())
      initialFocal.x.set(event.focalX)
      initialFocal.y.set(event.focalY)
    })
    .onUpdate((event) => {
      scale.set(clamp(savedScale.get() * event.scale, minScale, maxScale))
      const scaleChangeScale =
        (scale.get() - savedScale.get()) / savedScale.get()
      const centerOffsetX =
        savedFocal.x.get() + translate.x.get() + center.x - initialFocal.x.get()
      const centerOffsetY =
        savedFocal.y.get() + translate.y.get() + center.y - initialFocal.y.get()
      focal.x.set(centerOffsetX * scaleChangeScale + savedFocal.x.get())
      focal.y.set(centerOffsetY * scaleChangeScale + savedFocal.y.get())
    })
    .onEnd((...args) => {
      isZoomedIn.set(args[0].scale > 1)
      scheduleOnRN(onPinchEnded, ...args)
    })

  const doubleTapGesture = Gesture.Tap()
    .enabled(isDoubleTapEnabled)
    .numberOfTaps(2)
    .maxDuration(250)
    .onStart((event) => {
      if (scale.get() === 1) {
        isZoomedIn.set(true)
        scheduleOnRN(onDoubleTap, ZOOM_TYPE.ZOOM_IN)
        scale.set(withTiming(doubleTapScale))
        const focalX = (center.x - event.x) * (doubleTapScale - 1)
        const focalY = (center.y - event.y) * (doubleTapScale - 1)

        if (shouldResetOnInteractionEnd) {
          focal.x.set(withTiming(focalX))
          focal.y.set(withTiming(focalY))
        } else {
          focal.x.set(
            withTiming(focalX + translate.x.get() * (doubleTapScale - 1))
          )
          focal.y.set(
            withTiming(focalY + translate.y.get() * (doubleTapScale - 1))
          )
        }
      } else {
        isZoomedIn.set(false)
        scheduleOnRN(onDoubleTap, ZOOM_TYPE.ZOOM_OUT)
        reset()
      }
    })

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onStart((event) => {
      scheduleOnRN(onSingleTap, event)
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
    animatedStyle,
    gestures,
    isZoomedIn,
    reset,
    scale,
    transform
  }
}
