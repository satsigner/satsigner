import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import SSBinaryDisplay from '@/components/SSBinaryDisplay'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { Colors, Layout } from '@/styles'
import {
  generateMnemonicFromEntropy,
  getFingerprintFromMnemonic
} from '@/utils/bip39'
import {
  drawingPointsToBinary,
  getDrawingEntropyProgress,
  shouldAcceptDrawingSample,
  type DrawingPoint
} from '@/utils/drawingEntropy'

export default function DrawingEntropy() {
  const router = useRouter()
  const { height: screenHeight } = useWindowDimensions()
  const { index } = useLocalSearchParams()
  const completedRef = useRef(false)

  const [mnemonicWordCount, mnemonicWordList, setMnemonic, setFingerprint] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.mnemonicWordCount,
        state.mnemonicWordList,
        state.setMnemonic,
        state.setFingerprint
      ])
    )

  const bitLength = 32 * (mnemonicWordCount / 3)
  const canvasHeight = Math.min(screenHeight * 0.24, 200)

  const [points, setPoints] = useState<DrawingPoint[]>([])
  const [paths, setPaths] = useState<SkPath[]>([])
  const [strokeVersion, setStrokeVersion] = useState(0)
  const currentPathRef = useRef<SkPath | null>(null)
  const lastSampleRef = useRef<{ x: number; y: number } | null>(null)
  const pointsRef = useRef<DrawingPoint[]>([])

  const { estimatedBits } = getDrawingEntropyProgress(points.length, bitLength)
  const previewBits =
    points.length === 0
      ? ''
      : drawingPointsToBinary(points, bitLength).slice(0, estimatedBits)

  function finishWithPoints(nextPoints: DrawingPoint[]) {
    if (completedRef.current) {
      return
    }
    completedRef.current = true

    const bits = drawingPointsToBinary(nextPoints, bitLength)
    const mnemonic = generateMnemonicFromEntropy(bits, mnemonicWordList)
    setMnemonic(mnemonic)
    const fingerprint = getFingerprintFromMnemonic(mnemonic)
    setFingerprint(fingerprint)
    router.navigate(`/signer/bitcoin/account/add/generate/mnemonic/${index}`)
  }

  function addSample(x: number, y: number) {
    if (completedRef.current) {
      return
    }
    if (!shouldAcceptDrawingSample(lastSampleRef.current, { x, y })) {
      return
    }

    lastSampleRef.current = { x, y }
    const sample: DrawingPoint = { t: Date.now(), x, y }
    const nextPoints = [...pointsRef.current, sample]
    pointsRef.current = nextPoints
    setPoints(nextPoints)

    const { complete } = getDrawingEntropyProgress(nextPoints.length, bitLength)
    if (complete) {
      finishWithPoints(nextPoints)
    }
  }

  function handleClear() {
    if (completedRef.current) {
      return
    }
    pointsRef.current = []
    lastSampleRef.current = null
    currentPathRef.current = null
    setPoints([])
    setPaths([])
    setStrokeVersion((version) => version + 1)
  }

  function bumpStroke() {
    setStrokeVersion((version) => version + 1)
  }

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((event) => {
      if (completedRef.current) {
        return
      }
      const path = Skia.Path.Make()
      path.moveTo(event.x, event.y)
      currentPathRef.current = path
      bumpStroke()
      addSample(event.x, event.y)
    })
    .onUpdate((event) => {
      if (completedRef.current) {
        return
      }
      const path = currentPathRef.current
      if (!path) {
        return
      }
      path.lineTo(event.x, event.y)
      bumpStroke()
      addSample(event.x, event.y)
    })
    .onEnd(() => {
      const path = currentPathRef.current
      if (!path) {
        return
      }
      setPaths((prev) => [...prev, path])
      currentPathRef.current = null
      bumpStroke()
    })

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.entropy.drawing.title')}</SSText>
          )
        }}
      />
      <SSVStack gap="md" style={{ flex: 1 }}>
        <View style={styles.binary}>
          <SSBinaryDisplay binary={previewBits} />
        </View>
        <SSVStack itemsCenter gap="sm" style={styles.bottom}>
          <SSVStack itemsCenter style={{ gap: -20 }}>
            <SSText size="8xl">{estimatedBits}</SSText>
            <SSText size="sm" color="muted" uppercase>
              {t('common.of')} {bitLength}
            </SSText>
          </SSVStack>
          <SSText size="sm" color="muted" center style={{ letterSpacing: 0.5 }}>
            {t(`account.entropy.drawing.desc.${mnemonicWordCount}`)}
          </SSText>
          <SSText size="sm" color="muted" center>
            {t('account.entropy.drawing.bitsNote')}
          </SSText>
          <GestureDetector gesture={panGesture}>
            <View style={[styles.canvas, { height: canvasHeight }]}>
              <Canvas style={StyleSheet.absoluteFill}>
                {paths.map((path, pathIndex) => (
                  <Path
                    key={pathIndex}
                    path={path}
                    color={Colors.white}
                    style="stroke"
                    strokeWidth={3}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                ))}
                {currentPathRef.current ? (
                  <Path
                    key={`stroke-${strokeVersion}`}
                    path={currentPathRef.current}
                    color={Colors.white}
                    style="stroke"
                    strokeWidth={3}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                ) : null}
              </Canvas>
            </View>
          </GestureDetector>
          <SSButton
            label={t('common.clear')}
            variant="ghost"
            onPress={handleClear}
            disabled={points.length === 0}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  binary: {
    backgroundColor: Colors.gray[950],
    borderRadius: 8,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 16,
    width: '100%'
  },
  bottom: {
    flexShrink: 0,
    width: '100%'
  },
  canvas: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[850],
    borderRadius: 2,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%'
  },
  container: {
    paddingBottom: Layout.mainContainer.paddingBottom
  }
})
