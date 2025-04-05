import { SCREEN_HEIGHT } from '@gorhom/bottom-sheet'
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Paint,
  Paragraph,
  Path,
  Skia,
  TextAlign,
  useFonts
} from '@shopify/react-native-skia'
import { useMemo } from 'react'
import {
  Platform,
  type StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle
} from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { useGestures } from '@/hooks/useGestures'
import { useLayout } from '@/hooks/useLayout'
import { Colors } from '@/styles'
import { type BlockDifficulty } from '@/types/models/Blockchain'

const FACTOR_BLOCK_DISTANCE = 0.055
const RADIUS_SPIRAL_START = 1
const FACTOR_SPIRAL_GROWTH = 0.97
const BLOCK_SIZE = 5
const RADIUS_WEEKS = [180, 250, 320, 451]
const MIN_BRIGHTNESS = 20
const MAX_BRIGHTNESS_SIZE = 5000

type SSSpiralBlocksProps = {
  data: BlockDifficulty[]
  loading: boolean
  maxBlocksPerSpiral: number
  canvasWidth: number
  canvasHeight: number
  onBlockPress: (block: BlockDifficulty) => void
}

function SSSpiralBlocks({
  data,
  loading,
  maxBlocksPerSpiral,
  canvasWidth,
  canvasHeight,
  onBlockPress
}: SSSpiralBlocksProps) {
  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })

  const { width: w, height: h, center, onCanvasLayout } = useLayout()
  const { animatedStyle, gestures, transform } = useGestures({
    width: w,
    height: h,
    center,
    isDoubleTapEnabled: true,
    maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
    minPanPointers: 1,
    maxScale: 1000,
    minScale: 0.1,
    shouldResetOnInteractionEnd: false
  })

  const fontSize = 12

  const TextStyleWeeks = {
    color: Skia.Color(Colors.gray[100]),
    fontFamilies: ['SF Pro Text'],
    fontSize,
    fontStyle: {
      weight: 400
    }
  }

  const createParagraph = (text: string) => {
    if (!customFontManager) return null

    const paragraph = Skia.ParagraphBuilder.Make({
      maxLines: 1,
      textAlign: TextAlign.Center
    })
      .pushStyle(TextStyleWeeks)
      .addText(text)
      .pop()
      .build()

    paragraph.layout(100)
    return paragraph
  }

  const pWeek1 = useMemo(() => {
    return createParagraph('1 WEEK')
  }, [customFontManager]) // eslint-disable-line react-hooks/exhaustive-deps
  const pWeek2 = useMemo(() => {
    return createParagraph('2 WEEKS')
  }, [customFontManager]) // eslint-disable-line react-hooks/exhaustive-deps
  const pWeek3 = useMemo(() => {
    return createParagraph('3 WEEKS')
  }, [customFontManager]) // eslint-disable-line react-hooks/exhaustive-deps
  const pWeek4 = useMemo(() => {
    return createParagraph('4 WEEKS')
  }, [customFontManager]) // eslint-disable-line react-hooks/exhaustive-deps

  const spiralBlocks = useMemo(() => {
    if (!data || data.length === 0) return []

    const blocks = []
    let phi_spiral = RADIUS_SPIRAL_START / FACTOR_SPIRAL_GROWTH
    let arc_distance =
      FACTOR_SPIRAL_GROWTH *
      (Math.asinh(phi_spiral) + phi_spiral * Math.sqrt(phi_spiral ** 2 + 1))

    let radius_spiral = RADIUS_SPIRAL_START
    const maxIterations = Math.min(maxBlocksPerSpiral, data.length)

    for (let i = 0; i < maxIterations; i++) {
      const currentBlock = data[i] as BlockDifficulty
      const timeDifference = currentBlock?.timeDifference ?? 0
      const size = currentBlock?.size ?? 0
      const block_distance =
        i === 0 || i === maxBlocksPerSpiral - 1 ? 0 : timeDifference

      arc_distance += block_distance * FACTOR_BLOCK_DISTANCE
      phi_spiral = newtonRaphson(arc_distance, FACTOR_SPIRAL_GROWTH, phi_spiral)
      radius_spiral = FACTOR_SPIRAL_GROWTH * phi_spiral

      const x = radius_spiral * Math.cos(phi_spiral)
      const y = radius_spiral * Math.sin(phi_spiral)
      const brightness = MIN_BRIGHTNESS + (size / MAX_BRIGHTNESS_SIZE) * 256

      blocks.push({
        x,
        y,
        index: i,
        rotation: phi_spiral,
        color: `rgb(${brightness},${brightness},${brightness})`,
        timeDifference,
        height: currentBlock?.height || null
      })
    }
    return blocks
  }, [loading, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const paths = useMemo(() => {
    return spiralBlocks.map((block) => {
      const path = Skia.Path.Make()
      const halfSize = BLOCK_SIZE / 2
      const cosTheta = Math.cos(block.rotation)
      const sinTheta = Math.sin(block.rotation)
      const points = [
        [-halfSize, -halfSize],
        [halfSize, -halfSize],
        [halfSize, halfSize],
        [-halfSize, halfSize]
      ].map(([x, y]) => {
        const rotatedX = cosTheta * x - sinTheta * y
        const rotatedY = sinTheta * x + cosTheta * y
        return [rotatedX + block.x, rotatedY + block.y]
      })

      path.moveTo(
        points[0][0] + canvasWidth / 2,
        points[0][1] + canvasHeight / 2
      )
      path.lineTo(
        points[1][0] + canvasWidth / 2,
        points[1][1] + canvasHeight / 2
      )
      path.lineTo(
        points[2][0] + canvasWidth / 2,
        points[2][1] + canvasHeight / 2
      )
      path.lineTo(
        points[3][0] + canvasWidth / 2,
        points[3][1] + canvasHeight / 2
      )
      path.close()

      return path
    })
  }, [spiralBlocks, canvasHeight, canvasWidth])

  const invisibleOverlayBlocks = useMemo(() => {
    return spiralBlocks.map((block) => {
      return {
        position: 'absolute',
        top: canvasHeight / 2 + block.y - BLOCK_SIZE / 2,
        left: canvasWidth / 2 + block.x - BLOCK_SIZE / 2,
        width: BLOCK_SIZE + 3,
        height: BLOCK_SIZE + 3,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0)'
      } as StyleProp<ViewStyle>
    })
  }, [spiralBlocks, canvasWidth, canvasHeight])

  // If still loading data, show a loading spinner (an outlined circle)
  if (loading) {
    return (
      <View style={styles.container}>
        <Canvas
          style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}
        >
          <Circle
            cx={canvasWidth / 2}
            cy={canvasHeight / 2}
            r={40}
            color="transparent"
            style="stroke"
          >
            <Paint color="white" strokeWidth={6} />
          </Circle>
        </Canvas>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Canvas
        style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}
        onLayout={onCanvasLayout}
      >
        <Group
          transform={transform}
          origin={{ x: canvasWidth / 2, y: canvasHeight / 2 }}
        >
          {spiralBlocks.map((block, index) => (
            <Path key={index} path={paths[index]} color={block.color} />
          ))}

          {RADIUS_WEEKS.map((r, index) => {
            const weekRingColor = `rgb(${255 - index * 50}, ${255 - index * 50}, ${255 - index * 50})`
            return (
              <Circle
                key={index}
                cx={canvasWidth / 2}
                cy={canvasHeight / 2}
                r={r}
                color="transparent"
              >
                <Paint color={weekRingColor} style="stroke" strokeWidth={1}>
                  <DashPathEffect intervals={[5, 5]} phase={0} />
                </Paint>
              </Circle>
            )
          })}

          <Paragraph paragraph={pWeek1} x={0} y={135} width={canvasWidth} />
          <Paragraph paragraph={pWeek2} x={0} y={65} width={canvasWidth} />
          <Paragraph paragraph={pWeek3} x={0} y={-10} width={canvasWidth} />
          <Paragraph paragraph={pWeek4} x={0} y={-50} width={canvasWidth} />
        </Group>
      </Canvas>

      <GestureDetector gesture={gestures}>
        <View
          style={{
            flex: 1,
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          }}
        >
          <Animated.View
            style={[
              { width: canvasWidth, height: canvasHeight },
              animatedStyle
            ]}
            onLayout={onCanvasLayout}
          >
            {spiralBlocks.map((block, index) => {
              const style = invisibleOverlayBlocks[index]
              return (
                <TouchableOpacity
                  key={index}
                  style={style}
                  delayPressIn={0}
                  delayPressOut={0}
                  onPress={() => onBlockPress(data[index])}
                >
                  <Animated.View />
                </TouchableOpacity>
              )
            })}
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  )
}

/**
 * Newton-Raphson method to find roots of a function
 */
function newtonRaphson(
  L: number,
  k: number,
  initialGuess: number = 1.0,
  tolerance: number = 1e-6,
  maxIterations: number = 1000
): number {
  let t = initialGuess

  function f(t: number, L: number, k: number): number {
    return t ** 2 - L * k
  }

  function df(t: number): number {
    return 2 * t
  }

  for (let i = 0; i < maxIterations; i++) {
    const f_t = f(t, L, k)
    const df_t = df(t)
    if (Math.abs(f_t) < tolerance) {
      return t
    }
    t = t - f_t / df_t
  }

  throw new Error('Convergence Failed!')
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000'
  },
  canvas: {
    position: 'relative',
    backgroundColor: '#000',

    borderWidth: 1,
    borderColor: 'red'
  },
  touchableOverlay: {
    position: 'relative',
    top: -0.7 * SCREEN_HEIGHT, // Adjust as needed
    left: 0, // Adjust as needed
    right: 0,
    bottom: 0
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderRadius: 4
  },
  closeButtonText: {
    color: 'black',
    fontSize: 14
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    padding: 20
  },
  overlayCanvas: {
    width: 200,
    height: 200,
    backgroundColor: '#000',
    marginBottom: 16
  },
  overlayText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center'
  }
})

export default SSSpiralBlocks
