import { useState } from 'react'
import {
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'

import SSText from '@/components/SSText'
import { Colors } from '@/styles'

type SSNoteInlineImageProps = {
  uri: string
  onPress: () => void
}

function SSNoteInlineImage({ uri, onPress }: SSNoteInlineImageProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <Image
        source={{ uri }}
        onLoad={(e) => {
          const { width: w, height: h } = e.nativeEvent.source
          if (typeof w === 'number' && typeof h === 'number' && h > 0) {
            setAspectRatio(w / h)
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
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale)
    })
    .onEnd(() => {
      savedScale.value = scale.value
    })

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX
      translateY.value = savedTranslateY.value + e.translationY
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
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

  return (
    <GestureHandlerRootView style={styles.fullscreenRoot}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.fullscreenImageWrap, animatedStyle]}>
          <Image
            source={{ uri }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </Animated.View>
      </GestureDetector>
      <SafeAreaView style={styles.fullscreenHeader} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={12}
        >
          <SSText size="md" center>
            ✕
          </SSText>
        </TouchableOpacity>
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

type SSNoteInlineImagesProps = {
  uris: string[]
  style?: StyleProp<ViewStyle>
}

function SSNoteInlineImages({ uris, style }: SSNoteInlineImagesProps) {
  const [viewingUri, setViewingUri] = useState<string | null>(null)

  if (uris.length === 0) {
    return null
  }

  return (
    <>
      <View style={[styles.wrap, style]}>
        {uris.map((uri) => (
          <SSNoteInlineImage
            key={uri}
            uri={uri}
            onPress={() => setViewingUri(uri)}
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
    margin: 16,
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
