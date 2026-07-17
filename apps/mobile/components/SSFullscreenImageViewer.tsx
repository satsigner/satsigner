import {
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import SSText from '@/components/SSText'
import { Colors } from '@/styles'

const DISMISS_DRAG_THRESHOLD = 100
const DISMISS_VELOCITY_Y = -500

type SSFullscreenImageViewerContentProps = {
  onClose: () => void
  uri: string
}

function SSFullscreenImageViewerContent({
  onClose,
  uri
}: SSFullscreenImageViewerContentProps) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const windowHeightSV = useDerivedValue(() => windowHeight)

  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const dismissY = useSharedValue(0)
  const dismissPanOrigin = useSharedValue(0)
  const panStartedZoomed = useSharedValue(false)

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale)
    })
    .onEnd(() => {
      savedScale.value = scale.value
    })

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(0)
    .onStart(() => {
      panStartedZoomed.value = savedScale.value > 1.01
      dismissPanOrigin.value = dismissY.value
    })
    .onUpdate((e) => {
      if (panStartedZoomed.value) {
        translateX.value = savedTranslateX.value + e.translationX
        translateY.value = savedTranslateY.value + e.translationY
      } else {
        dismissY.value = Math.min(0, dismissPanOrigin.value + e.translationY)
      }
    })
    .onEnd((e) => {
      if (panStartedZoomed.value) {
        savedTranslateX.value = translateX.value
        savedTranslateY.value = translateY.value
      } else {
        const shouldDismiss =
          dismissY.value < -DISMISS_DRAG_THRESHOLD ||
          e.velocityY < DISMISS_VELOCITY_Y
        if (shouldDismiss) {
          const h = windowHeightSV.value
          dismissY.value = withTiming(-h, { duration: 220 }, (finished) => {
            if (finished) {
              runOnJS(onClose)()
            }
          })
        } else {
          dismissY.value = withTiming(0, { duration: 200 })
        }
      }
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(10)
    .onEnd(() => {
      scale.value = withTiming(1)
      savedScale.value = 1
      translateX.value = withTiming(0)
      translateY.value = withTiming(0)
      savedTranslateX.value = 0
      savedTranslateY.value = 0
    })

  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan))

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }))

  const sheetStyle = useAnimatedStyle(() => {
    const h = windowHeightSV.value
    return {
      opacity: interpolate(
        dismissY.value,
        [-h * 0.35, 0],
        [0.35, 1],
        Extrapolation.CLAMP
      ),
      transform: [{ translateY: dismissY.value }]
    }
  })

  return (
    <GestureHandlerRootView style={styles.fullscreenRoot}>
      <Animated.View style={[styles.fullscreenSheet, sheetStyle]}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.fullscreenImageWrap, animatedStyle]}>
            <Image
              source={{ uri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>
        <View
          style={[
            styles.fullscreenHeader,
            {
              paddingRight: insets.right + 12,
              paddingTop: insets.top + 8
            }
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={12}
          >
            <SSText size="md" center>
              ✕
            </SSText>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </GestureHandlerRootView>
  )
}

type SSFullscreenImageViewerProps = {
  onClose: () => void
  uri: string | null
  visible: boolean
}

export default function SSFullscreenImageViewer({
  onClose,
  uri,
  visible
}: SSFullscreenImageViewerProps) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {uri ? (
        <SSFullscreenImageViewerContent onClose={onClose} uri={uri} />
      ) : null}
    </Modal>
  )
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  fullscreenHeader: {
    alignItems: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  fullscreenImage: {
    flex: 1,
    width: '100%'
  },
  fullscreenImageWrap: {
    flex: 1
  },
  fullscreenRoot: {
    backgroundColor: Colors.black,
    flex: 1
  },
  fullscreenSheet: {
    backgroundColor: Colors.black,
    flex: 1
  }
})
