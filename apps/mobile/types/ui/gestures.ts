import { type LayoutRectangle } from 'react-native'
import {
  type GestureStateChangeEvent,
  type PanGestureHandlerEventPayload,
  type PinchGestureHandlerEventPayload,
  type TapGestureHandlerEventPayload
} from 'react-native-gesture-handler'
import { type AnimatableValue } from 'react-native-reanimated'

export type OnPinchStartCallback = (
  event: GestureStateChangeEvent<PinchGestureHandlerEventPayload>
) => void

export type OnPinchEndCallback = (
  event: GestureStateChangeEvent<PinchGestureHandlerEventPayload>,
  success: boolean
) => void

export type OnPanStartCallback = (
  event: GestureStateChangeEvent<PanGestureHandlerEventPayload>
) => void

export type OnPanEndCallback = (
  event: GestureStateChangeEvent<PanGestureHandlerEventPayload>,
  success: boolean
) => void

export type OnSingleTapCallback = (
  event: GestureStateChangeEvent<TapGestureHandlerEventPayload>
) => void

export enum ZOOM_TYPE {
  ZOOM_IN = 'ZOOM_IN',
  ZOOM_OUT = 'ZOOM_OUT'
}

export type OnDoubleTapCallback = (zoomType: ZOOM_TYPE) => void

export enum ANIMATION_VALUE {
  SCALE = 'SCALE',
  FOCAL_X = 'FOCAL_X',
  FOCAL_Y = 'FOCAL_Y',
  TRANSLATE_X = 'TRANSLATE_X',
  TRANSLATE_Y = 'TRANSLATE_Y'
}

export type OnResetAnimationEndCallback = (
  finished?: boolean,
  values?: Record<
    ANIMATION_VALUE,
    {
      finished?: boolean
      current?: AnimatableValue
    }
  >
) => void

export type ZoomProps = {
  minScale?: number
  /**
   * The maximum scale allowed for zooming.
   * @default 5
   */
  maxScale?: number
  /**
   * The value of the image scale when a double-tap gesture is detected.
   * @default 3
   */
  doubleTapScale?: number
  /**
   * The minimum number of pointers required to enable panning.
   * @default 2
   */
  minPanPointers?: number
  /**
   * The maximum number of pointers required to enable panning.
   * @default 2
   */
  maxPanPointers?: number
  /**
   * Initial offset for pointers.
   * @default {x:0,y:0}
   */
  initialTranslation?: {
    x: number
    y: number
  }
  /**
   * Determines whether panning is enabled within the range of the minimum and maximum pan pointers.
   * @default true
   */
  isPanEnabled?: boolean
  /**
   * Determines whether pinching is enabled.
   * @default true
   */
  isPinchEnabled?: boolean
  /**
   * Enables or disables the single tap feature.
   * @default false
   */
  isSingleTapEnabled?: boolean
  /**
   * Enables or disables the double tap feature.
   * When enabled, this feature prevents automatic reset of the canvas zoom to its initial position, allowing continuous zooming.
   * To return to the initial position, double tap again or zoom out to a scale level less than 1.
   * @default false
   */
  isDoubleTapEnabled?: boolean
  /**
   * Enables or disables the resetting the position after interaction ends.
   * @default false
   */
  shouldResetOnInteractionEnd?: boolean
  /**
   * A callback triggered when the canvas interaction starts.
   */
  onInteractionStart?: () => void
  /**
   * A callback triggered when the canvas interaction ends.
   */
  onInteractionEnd?: () => void
  /**
   * A callback triggered when the canvas pinching starts.
   */
  onPinchStart?: OnPinchStartCallback
  /**
   * A callback triggered when the canvas pinching ends.
   */
  onPinchEnd?: OnPinchEndCallback
  /**
   * A callback triggered when the canvas panning starts.
   */
  onPanStart?: OnPanStartCallback
  /**
   * A callback triggered when the canvas panning ends.
   */
  onPanEnd?: OnPanEndCallback
  /**
   * A callback triggered when a single tap is detected.
   */
  onSingleTap?: OnSingleTapCallback
  /**
   * A callback triggered when a double tap gesture is detected.
   */
  onDoubleTap?: OnDoubleTapCallback
  /**
   * A callback triggered upon the completion of the reset animation. It accepts two parameters: finished and values.
   * The finished parameter evaluates to true if all animation values have successfully completed the reset animation;
   * otherwise, it is false, indicating interruption by another gesture or unforeseen circumstances.
   * The values parameter provides additional detailed information for each animation value.
   */
}

export type ZoomLayoutState = LayoutRectangle & {
  /**
   * An object containing the x and y coordinates of the center point of the image, relative to the top-left corner of the container.
   */
  center: {
    /**
     * The x-coordinate of the center point of the canvas.
     */
    x: number
    /**
     * The y-coordinate of the center point of the canvas.
     */
    y: number
  }
}

export type ZoomUseGesturesProps = Pick<
  ZoomLayoutState,
  'width' | 'height' | 'center'
> &
  Pick<
    ZoomProps,
    | 'minScale'
    | 'maxScale'
    | 'doubleTapScale'
    | 'minPanPointers'
    | 'maxPanPointers'
    | 'isPanEnabled'
    | 'isPinchEnabled'
    | 'isSingleTapEnabled'
    | 'isDoubleTapEnabled'
    | 'onInteractionStart'
    | 'onInteractionEnd'
    | 'onPinchStart'
    | 'onPinchEnd'
    | 'onPanStart'
    | 'onPanEnd'
    | 'onSingleTap'
    | 'onDoubleTap'
    | 'shouldResetOnInteractionEnd'
    | 'initialTranslation'
  >
