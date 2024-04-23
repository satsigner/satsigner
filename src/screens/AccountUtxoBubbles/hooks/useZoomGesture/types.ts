import type {
  GestureStateChangeEvent,
  PinchGestureHandlerEventPayload,
  TapGestureHandlerEventPayload,
  PanGestureHandlerEventPayload
} from 'react-native-gesture-handler';
import type { HitSlop } from 'react-native-gesture-handler/lib/typescript/handlers/gestureHandlerCommon';
import type {
  EasingFunction,
  EasingFunctionFactory,
  ReduceMotion
} from 'react-native-reanimated';

type TimingConfig = Partial<{
  duration: number;
  easing: EasingFunction | EasingFunctionFactory;
  reduceMotion: ReduceMotion;
}>;

export type Vector<T> = {
  x: T;
  y: T;
};

export type SizeVector<T> = {
  width: T;
  height: T;
};

export type BoundsFuction = (scale: number) => Vector<number>;

/**
 * @description Determine how your component must behave when it reaches the specified boundaries
 * by its enclosing container.
 */
export enum PanMode {
  /** @description Prevents the user from dragging the component out of the specified boundaries. */
  CLAMP,

  /**
   * @description Lets the user drag the component around freely, when the pan gesture ends
   * the component will return to a position within the specified boundaries.
   */
  FREE,

  /**
   * @description Lets the user drag the component around freely applying friction to the pan gesture
   * up to a point where it's stopped completely, when the pan gesture ends the component will return
   * to a position within the specified boundaries.
   */
  FRICTION
}

/**
 * @description Determine how your component must behave when the pinch gesture's scale value
 * exceeds the specified boundaries by minScale and maxScale properties.
 */
export enum ScaleMode {
  /**
   * @description Prevents the user from exceeding the scale boundaries.
   */
  CLAMP,

  /**
   * @description Lets the user scale above and below the scale boundary values, when the pinch
   * gesture ends the scale value returns to minScale or maxScale respectively.
   */
  BOUNCE
}

export type CommonZoomProps = Partial<{
  /**
   * @description Increase (Android only) or decrease the gesture detection area around
   * your component in all directions by a given amount in pixels, useful when dealing
   * with small components.
   * @see https://docs.swmansion.com/react-native-gesture-handler/docs/gesture-handlers/common-gh/#hitslop
   */
  hitSlop: HitSlop;

  /**
   * @description Custom React Native Reanimated's animation timing configuration.
   * @see https://docs.swmansion.com/react-native-reanimated/docs/animations/withTiming/#config-
   */
  timingConfig: TimingConfig;

  onGestureEnd: () => void;
}>;

export type CommonResumableProps = Partial<{
  /**
   * @description Minimum scale value allowed by the pinch gesture, expects values greater than or
   * equals one.
   * @default 1
   */
  minScale: number;

  /**
   * @description Maximum scale value allowed by the pinch gesture, negative values instruct
   * the component to infer the maximum scale value based on cropSize and resolution properties
   * in a such way maxScale is a value just before images and videos start getting pixelated.
   * @default -1
   */
  maxScale: number;

  /**
   * @description Scale to apply when double tapping.
   * @default 2
   */
  doubleTapScale?: number;

  /**
   * @description Select which one of the three available pan modes to use.
   */
  panMode: PanMode;

  /**
   * @description Select which one of the two available scale modes to use.
   * @default ScaleMode.BOUNCE
   */
  scaleMode: ScaleMode;

  /**
   * @description Lets the user drag the component around as they pinch, it also provides a
   * more accurate pinch gesture calculation at the cost of a subtle jittering, disable for a
   * smoother but less accurate experience.
   * @default true
   */
  panWithPinch: boolean;
}>;

export type TapGestureEvent =
  GestureStateChangeEvent<TapGestureHandlerEventPayload>;

export type PinchGestureEvent =
  GestureStateChangeEvent<PinchGestureHandlerEventPayload>;

export type PanGestureEvent =
  GestureStateChangeEvent<PanGestureHandlerEventPayload>;

export type PanGestureEventCallback = (e: PanGestureEvent) => void;
export type TapGestureEventCallback = (e: TapGestureEvent) => void;
export type PinchGestureEventCallback = (e: PinchGestureEvent) => void;

export type PanGestureCallbacks = Partial<{
  /**
   * @description Callback triggered when the pan gesture starts.
   * @param e React native gesture handler's pan gesture event data.
   * @see https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pan-gesture/#event-data
   */
  onPanStart: PanGestureEventCallback;

  /**
   * @description Callback triggered when the pan gesture ends.
   * @param e React native gesture handler's pan gesture event data.
   * @see https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pan-gesture/#event-data
   */
  onPanEnd: PanGestureEventCallback;
}>;

export type PinchGestureCallbacks = Partial<{
  /**
   * @description Callback triggered when the pinch gesture ends.
   * @param e React native gesture handler's pinch gesture event data.
   * @see https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pinch-gesture/#event-data
   */
  onPinchStart: PinchGestureEventCallback;

  /**
   * @description Callback triggered when the pinch gesture ends.
   * @param e React native gesture handler's pinch gesture event data.
   * @see https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pinch-gesture/#event-data
   */
  onPinchEnd: PinchGestureEventCallback;
}>;

export type TapGestureCallbacks = Partial<{
  /**
   * @description Callback triggered when a tap is made.
   * @param e React native gesture handler's tap gesture event data.
   * @see https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/tap-gesture/#event-data
   */
  onTap: TapGestureEventCallback;

  /**
   * @description Callback triggered when a double tap is made.
   * @param e React native gesture handler's tap gesture event data.
   * @see https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/tap-gesture/#event-data
   */
  onDoubleTap: TapGestureEventCallback;
}>;

export type ResumableZoomState = {
  width: number;
  height: number;
  translateX: number;
  translateY: number;
  scale: number;
};

export type ResumableZoomAssignableState = Omit<
  ResumableZoomState,
  'width' | 'height'
>;

export type ResumableZoomType = {
  /**
   * @description Reset all transformations to their initial state.
   * @param animate Whether to animate the transition or not, defaults to true.
   */
  reset: (animate?: boolean) => void;

  /**
   * @description Request internal transformation values of this component at the moment of the calling.
   * @returns Internal state of the component.
   * @see https://glazzes.github.io/react-native-zoom-toolkit/components/resumablezoom.html#resumablezoomstate
   */
  requestState: () => ResumableZoomState;

  /**
   * @description Assigns the internal transformation values of this component, if the state you have
   * provided is considered to be not valid, it'll be approximated to the closest values you provided.
   * @see https://glazzes.github.io/react-native-zoom-toolkit/components/resumablezoom.html#resumablezoomassignablestate
   */
  assignState: (state: ResumableZoomAssignableState, animate?: boolean) => void;
};

export type ResumableZoomProps = React.PropsWithChildren<{
  /**
   * @description Whether to apply a decay animation when the pan gesture ends or not.
   * @default true
   * @see https://docs.swmansion.com/react-native-reanimated/docs/animations/withDecay/
   */
  decay?: boolean;

  /**
   * @description Enables and disables both single and double tap gestures.
   * @default true
   */
  tapsEnabled?: boolean;

  /**
   * @description Enables and disables both pan and swipe gestures.
   * @default true
   */
  panEnabled?: boolean;

  /**
   * @description Enables and disables the pinch gesture.
   * @default true
   */
  pinchEnabled?: boolean;

  /**
   * @description Maximum scale value allowed by the pinch gesture, expects values 
   * bigger than or equals one.

   * Alternatively you can pass the resolution of your image or video, for instance  {width: 1920, height: 1080}; 
   * this will instruct the component to calculate maxScale  in such a way it's a value just before
   * images and videos start getting pixelated.
   * @default 6
   */
  maxScale?: SizeVector<number> | number;

  /**
   * @description Callback triggered when a swipe to the left gesture has occurred, this callback is
   * only triggered when your component is at its minimum scale and panMode property is set to
   * PanMode.CLAMP.
   */
  onSwipeLeft?: () => void;

  /**
   * @description Callback triggered when a swipe to the right gesture has occurred, this callback is
   * only triggered when your component is at its minimum scale and panMode property is set to
   * PanMode.CLAMP
   */
  onSwipeRight?: () => void;

  /**
   * @description Worklet Callback triggered as the user interacts with the component, it also means
   * interacting through its methods, ideal if you need to mirror the internal state of the
   * component to some other component as it updates.
   * @param e Internal state of the gesture.
   * @see https://docs.swmansion.com/react-native-reanimated/docs/2.x/fundamentals/worklets/
   * @see https://glazzes.github.io/react-native-zoom-toolkit/components/resumablezoom.html#resumablezoomstate
   */
  onGestureActive?: (e: ResumableZoomState) => void;

  /**
   * @description Callback triggered when the component has been panned beyond the boundaries
   * defined by its enclosing container, ideal property to mimic scroll behavior. This callback is
   * only triggered when the panMode property is set to PanMode.CLAMP.
   * @param exceededBy How much the component has been panned beyond its enclosing container boundaries,
   * receives positive values from the right and negative values from the left.
   */
  onHorizontalBoundsExceeded?: (exceededBy: number) => void;
}> &
  PanGestureCallbacks &
  PinchGestureCallbacks &
  Omit<TapGestureCallbacks, 'onDoubleTap'> &
  Omit<CommonResumableProps, 'maxScale'> &
  Omit<CommonZoomProps, 'timingConfig'>;
