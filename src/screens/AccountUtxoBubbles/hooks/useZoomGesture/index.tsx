/**
 * Provides a custom hook for handling zoom and pan gestures on a content container.
 * This hook manages scale transformations and translations, allowing pinch-to-zoom
 * and drag-to-pan functionalities.
 *
 * This is mostly the code from react-native-zoom-reanimated with slight modifications
 * https://github.com/kesha-antonov/react-native-zoom-reanimated/tree/main
 *
 * @param {UseZoomGestureProps} props - Configuration options for animations and double tap behavior.
 * @returns {UseZoomGestureReturn} - Returns the gesture handlers, animated styles, and layout event handlers.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { LayoutChangeEvent } from 'react-native';
import {
  ComposedGesture,
  Gesture,
  GestureStateChangeEvent,
  GestureTouchEvent,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
  PinchGestureHandlerEventPayload,
  State
} from 'react-native-gesture-handler';
import { GestureStateManagerType } from 'react-native-gesture-handler/lib/typescript/handlers/gestures/gestureStateManager';
import {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { MAX_SCALE, MIN_SCALE } from './constants';
import { clampScale } from './utils';

interface UseZoomGestureProps {
  animationFunction?: typeof withTiming;
  animationConfig?: object;
  doubleTapConfig?: {
    defaultScale?: number;
  };
}

interface UseZoomGestureReturn {
  zoomGesture: ComposedGesture;
  contentContainerAnimatedStyle: any;
  onLayout(event: LayoutChangeEvent): void;
  onLayoutContent(event: LayoutChangeEvent): void;
  transform: Readonly<SharedValue<any>>;
}

export function useZoomGesture(
  props: UseZoomGestureProps = {}
): UseZoomGestureReturn {
  const {
    animationFunction = withTiming,
    animationConfig,
    doubleTapConfig
  } = props;

  // scale values for pinch gesture
  const baseScale = useSharedValue(1); // base scale for the content
  const pinchScale = useSharedValue(1); // dynamic scale, changing when pinching
  const lastScale = useSharedValue(1); // saved scale for panning to works properly

  // for handling zoom in/out and double tap
  const isZoomedIn = useSharedValue(false);
  // for tracking the last time a gesture was performed
  const zoomGestureLastTime = useSharedValue(0);

  // Dimensions of the container and content for calculating transformations
  const containerDimensions = useSharedValue({ width: 0, height: 0 });
  const contentDimensions = useSharedValue({ width: 1, height: 1 });

  // Translation values for handling pan gestures
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastOffsetX = useSharedValue(0);
  const lastOffsetY = useSharedValue(0);
  const panStartOffsetX = useSharedValue(0);
  const panStartOffsetY = useSharedValue(0);

  const handlePanOutsideTimeoutId: React.MutableRefObject<
    NodeJS.Timeout | undefined
  > = useRef();

  const withAnimation = useCallback(
    (toValue: number, config?: object) => {
      'worklet';

      return animationFunction(toValue, {
        duration: 350,
        ...config,
        ...animationConfig
      });
    },
    [animationFunction, animationConfig]
  );

  // get the size of the content and container
  const getContentContainerSize = useCallback(() => {
    return {
      width: containerDimensions.value.width,
      height:
        (contentDimensions.value.height * containerDimensions.value.width) /
        contentDimensions.value.width
    };
  }, [containerDimensions, contentDimensions]);

  const zoomIn = useCallback((): void => {
    const newScale = doubleTapConfig?.defaultScale ?? MIN_SCALE;

    const clampedScale = clampScale(newScale, MIN_SCALE, MAX_SCALE);

    lastScale.value = clampedScale;

    baseScale.value = withAnimation(newScale);
    pinchScale.value = withAnimation(1);

    const newOffsetX = 0;
    lastOffsetX.value = newOffsetX;

    const newOffsetY = 0;
    lastOffsetY.value = newOffsetY;

    translateX.value = newOffsetX;
    translateY.value = newOffsetY;

    isZoomedIn.value = true;
  }, [
    baseScale,
    pinchScale,
    lastOffsetX,
    lastOffsetY,
    translateX,
    translateY,
    isZoomedIn,
    lastScale,
    getContentContainerSize,
    withAnimation,
    doubleTapConfig
  ]);

  const zoomOut = useCallback((): void => {
    const newScale = 1;
    lastScale.value = newScale;

    baseScale.value = withAnimation(newScale);
    pinchScale.value = withAnimation(1);

    const newOffsetX = 0;
    lastOffsetX.value = newOffsetX;

    const newOffsetY = 0;
    lastOffsetY.value = newOffsetY;

    translateX.value = withAnimation(newOffsetX);
    translateY.value = withAnimation(newOffsetY);

    isZoomedIn.value = false;
  }, [
    baseScale,
    pinchScale,
    lastOffsetX,
    lastOffsetY,
    translateX,
    translateY,
    lastScale,
    isZoomedIn,
    withAnimation
  ]);

  /**
   * Handles the scenario where the pan gesture results in the content being moved outside of the allowable viewable area.
   * This function recalculates and adjusts the translation values to ensure the content remains within the bounds.
   * It uses a timeout to delay the execution slightly, which can help in managing rapid successive gestures.
   */
  const handlePanOutside = useCallback((): void => {
    // Clear any existing timeout to reset the debounce mechanism
    if (handlePanOutsideTimeoutId.current !== undefined)
      clearTimeout(handlePanOutsideTimeoutId.current);

    // Set a timeout to delay the execution of the function
    handlePanOutsideTimeoutId.current = setTimeout((): void => {
      const { width, height } = getContentContainerSize();

      // Calculate the maximum allowable offsets based on the current scale and container dimensions
      const maxOffset = {
        x:
          width * lastScale.value < containerDimensions.value.width
            ? 0
            : (width * lastScale.value - containerDimensions.value.width) /
              2 /
              lastScale.value,
        y:
          height * lastScale.value < containerDimensions.value.height
            ? 0
            : (height * lastScale.value - containerDimensions.value.height) /
              2 /
              lastScale.value
      };

      // Check if the current X translation is outside the allowable range and adjust if necessary
      const isPanedXOutside =
        lastOffsetX.value > maxOffset.x || lastOffsetX.value < -maxOffset.x;
      if (isPanedXOutside) {
        const newOffsetX = lastOffsetX.value >= 0 ? maxOffset.x : -maxOffset.x;
        lastOffsetX.value = newOffsetX;

        // Animate the translation adjustment
        translateX.value = withAnimation(newOffsetX);
      } else {
        translateX.value = lastOffsetX.value;
      }

      // Check if the current Y translation is outside the allowable range and adjust if necessary
      const isPanedYOutside =
        lastOffsetY.value > maxOffset.y || lastOffsetY.value < -maxOffset.y;
      if (isPanedYOutside) {
        const newOffsetY = lastOffsetY.value >= 0 ? maxOffset.y : -maxOffset.y;
        lastOffsetY.value = newOffsetY;

        translateY.value = withAnimation(newOffsetY);
      } else {
        translateY.value = lastOffsetY.value;
      }
    }, 10);
  }, [
    lastOffsetX,
    lastOffsetY,
    lastScale,
    translateX,
    translateY,
    containerDimensions,
    getContentContainerSize,
    withAnimation
  ]);

  const onDoubleTap = useCallback((): void => {
    if (isZoomedIn.value) zoomOut();
    else zoomIn();
  }, [zoomIn, zoomOut, isZoomedIn]);

  // getting the container dimensions
  const onLayout = useCallback(
    ({
      nativeEvent: {
        layout: { width, height }
      }
    }: LayoutChangeEvent): void => {
      containerDimensions.value = {
        width,
        height
      };
    },
    [containerDimensions]
  );

  // getting the content dimensions
  const onLayoutContent = useCallback(
    ({
      nativeEvent: {
        layout: { width, height }
      }
    }: LayoutChangeEvent): void => {
      contentDimensions.value = {
        width,
        height
      };
    },
    [contentDimensions]
  );

  /**
   * Handles the end of a pinch gesture by updating the scale values and determining the next steps based on the new scale.
   * This function adjusts the zoom level of the content and ensures that the content remains within the allowable viewable area or resets to the default view.
   *
   * @param {number} scale - The scale factor derived from the pinch gesture.
   */
  const onPinchEnd = useCallback(
    (scale: number): void => {
      // Calculate the new scale by multiplying the last known scale with the scale factor from the pinch gesture.
      const newScale = lastScale.value * scale;
      lastScale.value = newScale;
      // If the new scale is greater than 1, it indicates a zoom-in action.
      if (newScale > 1) {
        isZoomedIn.value = true; // Update the state to indicate that the content is zoomed in.
        baseScale.value = newScale; // Set the base scale to the new scale.
        pinchScale.value = 1; // Reset the pinch scale to 1 as the gesture has ended.

        handlePanOutside(); // Adjust the position if the content is outside the allowable area.
      } else {
        zoomOut();
      }
    },
    [lastScale, baseScale, pinchScale, handlePanOutside, zoomOut, isZoomedIn]
  );

  const updateZoomGestureLastTime = useCallback((): void => {
    'worklet';

    zoomGestureLastTime.value = Date.now();
  }, [zoomGestureLastTime]);

  const zoomGesture = useMemo(() => {
    const tapGesture = Gesture.Tap()
      .numberOfTaps(2)
      .onStart(() => {
        updateZoomGestureLastTime();
      })
      .onEnd(() => {
        updateZoomGestureLastTime();

        runOnJS(onDoubleTap)();
      })
      .maxDeltaX(25) // max delta x for tap gesture
      .maxDeltaY(25); // max delta y for tap gesture

    const panGesture = Gesture.Pan()
      .onStart(
        (event: GestureUpdateEvent<PanGestureHandlerEventPayload>): void => {
          updateZoomGestureLastTime();

          const { translationX, translationY } = event;

          panStartOffsetX.value = translationX;
          panStartOffsetY.value = translationY;
        }
      )
      .onUpdate(
        (event: GestureUpdateEvent<PanGestureHandlerEventPayload>): void => {
          updateZoomGestureLastTime();

          let { translationX, translationY } = event;
          // calculate the translation of the pan gesture
          translationX -= panStartOffsetX.value;
          translationY -= panStartOffsetY.value;

          translateX.value = lastOffsetX.value + translationX / lastScale.value;
          translateY.value = lastOffsetY.value + translationY / lastScale.value;
        }
      )
      .onEnd(
        (
          event: GestureStateChangeEvent<PanGestureHandlerEventPayload>
        ): void => {
          updateZoomGestureLastTime();

          let { translationX, translationY } = event;
          // calculate the translation of the pan gesture
          translationX -= panStartOffsetX.value;
          translationY -= panStartOffsetY.value;

          // Saves last position
          lastOffsetX.value =
            lastOffsetX.value + translationX / lastScale.value;
          lastOffsetY.value =
            lastOffsetY.value + translationY / lastScale.value;

          runOnJS(handlePanOutside)();
        }
      )
      .onTouchesMove(
        (e: GestureTouchEvent, state: GestureStateManagerType): void => {
          // Activate the gesture if conditions are met during touch movement.
          if (([State.UNDETERMINED, State.BEGAN] as State[]).includes(e.state))
            if (isZoomedIn.value || e.numberOfTouches === 2) state.activate();
            else state.fail();
        }
      )
      .minDistance(0)
      .minPointers(2)
      .maxPointers(2);

    const pinchGesture = Gesture.Pinch()
      .onStart(() => {
        updateZoomGestureLastTime();
      })
      .onUpdate(
        ({
          scale
        }: GestureUpdateEvent<PinchGestureHandlerEventPayload>): void => {
          updateZoomGestureLastTime();

          pinchScale.value = scale;
        }
      )
      .onEnd(
        ({
          scale
        }: GestureUpdateEvent<PinchGestureHandlerEventPayload>): void => {
          updateZoomGestureLastTime();

          pinchScale.value = scale;

          runOnJS(onPinchEnd)(scale);
        }
      )
      .onFinalize(() => {});

    return Gesture.Simultaneous(tapGesture, panGesture, pinchGesture);
  }, [
    handlePanOutside,
    lastOffsetX,
    lastOffsetY,
    onDoubleTap,
    onPinchEnd,
    pinchScale,
    translateX,
    translateY,
    lastScale,
    isZoomedIn,
    panStartOffsetX,
    panStartOffsetY,
    updateZoomGestureLastTime
  ]);

  // Styles for the Animated View on top of Skia element
  const contentContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: baseScale.value * pinchScale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ]
  }));

  // Transform for the Skia element
  const transform = useDerivedValue(() => {
    return [
      { scale: baseScale.value * pinchScale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ];
  });

  return {
    zoomGesture,
    contentContainerAnimatedStyle,
    onLayout,
    onLayoutContent,
    transform
  };
}
