import { useState } from 'react'
import {
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle
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
import { useImageActionsStore } from '@/store/imageActions'
import { Colors } from '@/styles'
import { parseImageExif } from '@/utils/imageExif'

const DISMISS_DRAG_THRESHOLD = 100
const DISMISS_VELOCITY_Y = -500

type ImageDimensions = { width: number; height: number }

type SSNoteInlineImageProps = {
  uri: string
  onPress: () => void
  onLongPress: (uri: string, dimensions: ImageDimensions) => void
}

function SSNoteInlineImage({
  uri,
  onPress,
  onLongPress
}: SSNoteInlineImageProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const [dimensions, setDimensions] = useState<ImageDimensions>({
    height: 0,
    width: 0
  })

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onLongPress={() => onLongPress(uri, dimensions)}
      delayLongPress={400}
    >
      <Image
        source={{ uri }}
        onLoad={(e) => {
          const { width: w, height: h } = e.nativeEvent.source
          if (typeof w === 'number' && typeof h === 'number' && h > 0) {
            setAspectRatio(w / h)
            setDimensions({ height: h, width: w })
          }
        }}
        style={[
          styles.image,
          aspectRatio !== null ? { aspectRatio } : styles.imagePlaceholder
        ]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  )
}

function FullscreenImageViewer({
  uri,
  onClose
}: {
  uri: string
  onClose: () => void
}) {
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

async function fetchImageMeta(uri: string) {
  const filename = uri.split('/').pop()?.split('?')[0] ?? undefined
  try {
    const res = await fetch(uri, { method: 'HEAD' })
    const contentType = res.headers.get('content-type') ?? undefined
    const contentLength = res.headers.get('content-length')
    const fileSize =
      contentLength !== null ? parseInt(contentLength, 10) : undefined
    return { contentType, fileSize, filename }
  } catch {
    return { filename }
  }
}

type SSNoteInlineImagesProps = {
  uris: string[]
  style?: StyleProp<ViewStyle>
}

function SSNoteInlineImages({ uris, style }: SSNoteInlineImagesProps) {
  const [viewingUri, setViewingUri] = useState<string | null>(null)
  const setSelectedImage = useImageActionsStore((s) => s.setSelectedImage)

  if (uris.length === 0) {
    return null
  }

  async function handleLongPress(uri: string, dimensions: ImageDimensions) {
    // Show drawer immediately with what we know
    setSelectedImage({
      height: dimensions.height,
      uri,
      width: dimensions.width
    })
    // Fetch HTTP headers and EXIF in parallel
    const [meta, exif] = await Promise.all([
      fetchImageMeta(uri),
      parseImageExif(uri)
    ])
    setSelectedImage({
      contentType: meta.contentType,
      exif,
      fileSize: meta.fileSize,
      filename: meta.filename,
      height: dimensions.height,
      uri,
      width: dimensions.width
    })
  }

  return (
    <>
      <View style={[styles.wrap, style]}>
        {uris.map((uri) => (
          <SSNoteInlineImage
            key={uri}
            uri={uri}
            onPress={() => setViewingUri(uri)}
            onLongPress={(u, d) => void handleLongPress(u, d)}
          />
        ))}
      </View>
      <Modal
        visible={viewingUri !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setViewingUri(null)}
        statusBarTranslucent
      >
        {viewingUri !== null && (
          <FullscreenImageViewer
            uri={viewingUri}
            onClose={() => setViewingUri(null)}
          />
        )}
      </Modal>
    </>
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
  },
  image: {
    backgroundColor: Colors.gray[800],
    borderRadius: 3,
    width: '100%'
  },
  imagePlaceholder: {
    minHeight: 160,
    width: '100%'
  },
  wrap: {
    gap: 8,
    marginTop: 8,
    width: '100%'
  }
})

export default SSNoteInlineImages
