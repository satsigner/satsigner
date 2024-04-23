import React, {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef
} from 'react';
import { LayoutChangeEvent, Platform } from 'react-native';
import {
  ComposedGesture,
  Gesture,
  GestureStateChangeEvent,
  GestureTouchEvent,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
  PinchGestureHandlerEventPayload,
  SimultaneousGesture,
  State
} from 'react-native-gesture-handler';
import { GestureStateManagerType } from 'react-native-gesture-handler/lib/typescript/handlers/gestures/gestureStateManager';
import {
  SharedValue,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { DEFAULT_HITSLOP } from './constants';
import { clamp } from './utils/clamp';

import { usePanCommons } from '../usePanCommons';
import { usePinchCommons } from '../usePinchCommons';
import { useSizeVector } from '../useSizeVector';
import { useVector } from '../useVector';

import {
  BoundsFuction,
  PanMode,
  ResumableZoomAssignableState,
  ResumableZoomProps,
  ResumableZoomState,
  ResumableZoomType,
  ScaleMode
} from './types';
import { getMaxScale } from './utils/getMaxScale';
import { pinchTransform } from './utils/pinchTransform';

interface UseZoomGestureReturn {
  zoomGesture: ComposedGesture;
  contentContainerAnimatedStyle: any;
  onLayout(event: LayoutChangeEvent): void;
  onLayoutContent(event: LayoutChangeEvent): void;
  transform: Readonly<SharedValue<any>>;
}

type ResumableReference = React.ForwardedRef<ResumableZoomType> | undefined;

export function useZoomGesture(
  props: ResumableZoomProps = {}
): UseZoomGestureReturn {
  const ref = (props as any).reference as ResumableReference;

  const {
    hitSlop = DEFAULT_HITSLOP,
    decay = true,
    tapsEnabled = true,
    panEnabled = true,
    pinchEnabled = true,
    minScale = 1,
    maxScale: userMaxScale = 6,
    panMode = PanMode.CLAMP,
    scaleMode = ScaleMode.BOUNCE,
    panWithPinch = Platform.OS !== 'ios',
    onTap,
    onGestureActive,
    onGestureEnd,
    onSwipeRight,
    onSwipeLeft,
    onPinchStart: onUserPinchStart,
    onPinchEnd: onUserPinchEnd,
    onPanStart: onUserPanStart,
    onPanEnd: onUserPanEnd,
    onHorizontalBoundsExceeded
  } = props;

  const translate = useVector(0, 0);
  const offset = useVector(0, 0);
  const scale = useSharedValue<number>(minScale);
  const scaleOffset = useSharedValue<number>(minScale);

  const origin = useVector(0, 0);
  const delta = useVector(0, 0);

  const rootContainer = useSizeVector(0, 0);
  const detector = useSizeVector(0, 0);
  const detectorTranslate = useVector(0, 0);
  const detectorScale = useSharedValue(minScale);

  useAnimatedReaction(
    () => {
      return {
        scale: scale.value,
        scaleOffset: scaleOffset.value,
        detectorScale: detectorScale.value
      };
    },
    s => {
      console.log(s);
    }
  );

  const maxScale = useDerivedValue(() => {
    if (typeof userMaxScale === 'object') {
      return getMaxScale(
        { width: detector.width.value, height: detector.height.value },
        userMaxScale
      );
    }

    return userMaxScale;
  }, [userMaxScale, detector]);

  const boundsFn: BoundsFuction = scaleValue => {
    'worklet';
    const { width: dWidth, height: dHeight } = detector;
    const { width: rWidth, height: rHeight } = rootContainer;

    const boundX = Math.max(0, dWidth.value * scaleValue - rWidth.value) / 2;
    const boundY = Math.max(0, dHeight.value * scaleValue - rHeight.value) / 2;
    return { x: boundX, y: boundY };
  };

  const reset = (
    toX: number,
    toY: number,
    toScale: number,
    animate: boolean = true
  ) => {
    'worklet';
    detectorTranslate.x.value = translate.x.value;
    detectorTranslate.y.value = translate.y.value;
    detectorScale.value = scale.value;

    translate.x.value = animate ? withTiming(toX) : toX;
    translate.y.value = animate ? withTiming(toY) : toY;
    scale.value = animate ? withTiming(toScale) : toScale;
    detectorTranslate.x.value = animate ? withTiming(toX) : toX;
    detectorTranslate.y.value = animate ? withTiming(toY) : toY;
    detectorScale.value = animate ? withTiming(toScale) : toScale;
  };

  useDerivedValue(() => {
    onGestureActive?.({
      width: detector.width.value,
      height: detector.height.value,
      translateX: translate.x.value,
      translateY: translate.y.value,
      scale: scale.value
    });
  }, [translate, detector, scale]);

  const { gesturesEnabled, onPinchStart, onPinchUpdate, onPinchEnd } =
    usePinchCommons({
      detector,
      detectorTranslate,
      detectorScale,
      translate,
      offset,
      origin,
      scale,
      scaleOffset,
      minScale,
      maxScale,
      delta,
      panWithPinch,
      scaleMode,
      panMode,
      boundFn: boundsFn,
      userCallbacks: {
        onGestureEnd,
        onPinchStart: onUserPinchStart,
        onPinchEnd: onUserPinchEnd
      }
    });

  const { onPanStart, onPanChange, onPanEnd } = usePanCommons({
    detector,
    detectorTranslate,
    translate,
    offset,
    scale,
    minScale,
    maxScale,
    panMode,
    boundFn: boundsFn,
    decay,
    userCallbacks: {
      onSwipeRight,
      onSwipeLeft,
      onGestureEnd,
      onPanStart: onUserPanStart,
      onPanEnd: onUserPanEnd,
      onHorizontalBoundsExceeded
    }
  });

  const pinch = Gesture.Pinch()
    .enabled(pinchEnabled)
    .hitSlop(hitSlop)
    .onStart(onPinchStart)
    .onUpdate(onPinchUpdate)
    .onEnd(onPinchEnd);

  const pan = Gesture.Pan()
    .enabled(panEnabled && gesturesEnabled)
    .hitSlop(hitSlop)
    .maxPointers(1)
    .onStart(onPanStart)
    .onChange(onPanChange)
    .onEnd(onPanEnd);

  const tap = Gesture.Tap()
    .enabled(tapsEnabled && gesturesEnabled)
    .maxDuration(250)
    .numberOfTaps(1)
    .hitSlop(hitSlop)
    .runOnJS(true)
    .onEnd(e => onTap?.(e));

  const doubleTap = Gesture.Tap()
    .enabled(tapsEnabled && gesturesEnabled)
    .maxDuration(250)
    .numberOfTaps(2)
    .hitSlop(hitSlop)
    .onEnd(e => {
      const targetScale = props.doubleTapScale || 2; // Default to 2 if not specified
      if (scale.value >= targetScale * 0.8) {
        reset(0, 0, minScale, true);
        return;
      }

      const originX = e.x - detector.width.value / 2;
      const originY = e.y - detector.height.value / 2;

      const { x, y } = pinchTransform({
        toScale: targetScale,
        fromScale: scale.value,
        origin: { x: originX, y: originY },
        delta: { x: 0, y: 0 },
        offset: { x: translate.x.value, y: translate.y.value }
      });

      const { x: boundX, y: boundY } = boundsFn(targetScale);
      const toX = clamp(x, -1 * boundX, boundX);
      const toY = clamp(y, -1 * boundY, boundY);

      reset(toX, toY, targetScale, true);
    });

  const measureRoot = (e: LayoutChangeEvent) => {
    rootContainer.width.value = e.nativeEvent.layout.width;
    rootContainer.height.value = e.nativeEvent.layout.height;
  };

  const measureContainer = (e: LayoutChangeEvent) => {
    detector.width.value = e.nativeEvent.layout.width;
    detector.height.value = e.nativeEvent.layout.height;
  };

  const transform = useDerivedValue(
    () => [
      { translateX: translate.x.value },
      { translateY: translate.y.value },
      { scale: scale.value }
    ],
    [translate, scale]
  );

  const detectorStyle = useAnimatedStyle(
    () => ({
      width: detector.width.value,
      height: detector.height.value,
      position: 'absolute',
      transform: [
        { translateX: detectorTranslate.x.value },
        { translateY: detectorTranslate.y.value },
        { scale: detectorScale.value }
      ]
    }),
    [detector, detectorTranslate, detectorScale]
  );

  const requestState = (): ResumableZoomState => {
    return {
      width: detector.width.value,
      height: detector.height.value,
      translateX: translate.x.value,
      translateY: translate.y.value,
      scale: scale.value
    };
  };

  const assignState = (
    state: ResumableZoomAssignableState,
    animate: boolean = true
  ) => {
    const toScale = clamp(state.scale, minScale, maxScale.value);
    const { x: boundX, y: boundY } = boundsFn(toScale);
    const toX = clamp(state.translateX, -1 * boundX, boundX);
    const toY = clamp(state.translateY, -1 * boundY, boundY);

    if (animate) {
      reset(toX, toY, toScale, animate);
      return;
    }

    reset(toX, toY, toScale, animate);
  };

  useImperativeHandle(ref, () => ({
    reset: animate => reset(0, 0, minScale, animate),
    requestState: requestState,
    assignState: assignState
  }));

  const composedTap = Gesture.Exclusive(doubleTap, tap);
  const composedGesture = Gesture.Race(pinch, pan, composedTap);

  return {
    zoomGesture: composedGesture,
    contentContainerAnimatedStyle: detectorStyle,
    onLayout: measureRoot,
    onLayoutContent: measureContainer,
    transform
  };
}
