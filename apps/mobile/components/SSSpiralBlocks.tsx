import {
  Canvas,
  Circle,
  DashPathEffect,
  Paint,
  Paragraph,
  Path,
  Rect,
  Skia,
  TextAlign,
  useFonts
} from '@shopify/react-native-skia'
import { useEffect, useMemo, useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import Animated from 'react-native-reanimated'

import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import { Colors } from '@/styles'

type SSSpiralBlocksProps = {
  currentFileIndex: number
  onChangeFileIndex: (value: number) => void
  data: any[]
  loading: boolean
  maxBlocksPerSpiral: number
  canvasWidth: number
  canvasHeight: number
}

const FACTOR_BLOCK_DISTANCE = 0.04
const RADIUS_SPIRAL_START = 1
const FACTOR_SPIRAL_GROWTH = 0.8
const BLOCK_SIZE = 3
const RADIUS_WEEKS = [110, 160, 220, 270]
const CANVAS_TOP_OFFSET = 140
const MIN_BRIGHTNESS = 20
const MAX_BRIGHTNESS_SIZE = 5000

function SSSpiralBlocks({
  canvasWidth,
  canvasHeight,
  currentFileIndex,
  onChangeFileIndex,
  maxBlocksPerSpiral,
  data,
  loading
}: SSSpiralBlocksProps) {
  const [_pressedBlocks, setPressedBlocks] = useState<{
    [key: number]: boolean
  }>({})

  const handlePressIn = (index: number) => {
    setPressedBlocks((prevState) => ({
      ...prevState,
      [index]: true
    }))
  }
  const handlePressOut = (index: number) => {
    setPressedBlocks((prevState) => ({
      ...prevState,
      [index]: false
    }))
  }

  const handleBlockPress = (index: number) => {
    const block = spiralBlocks[index]
    const height = block?.height || 675

    if (!height) {
      throw new Error('Block height not found, using fallback height of 675')
    }

    // TODO: add esplorerViews route
    // router.push({
    //   pathname: 'explorer/explorerViews',
    //   params: { view: 'block', height }
    // } as any)
  }

  // State for fetching data
  const [inputValue, setInputValue] = useState(String(currentFileIndex))

  // State for the overlay view when a block is clicked.
  // It stores the block index and the current file index.
  const [selectedBlock, setSelectedBlock] = useState<{
    blockIndex: number
    fileIndex: number
  } | null>(null)

  // State to store fetched block details from the API
  const [blockDetails, setBlockDetails] = useState<any>(null)
  // State to track loading status for block details
  const [loadingBlockDetails, setLoadingBlockDetails] = useState(false)

  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
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

    const spiralData = data[0]
    const blocks = []
    let phi_spiral = RADIUS_SPIRAL_START / FACTOR_SPIRAL_GROWTH
    let arc_distance =
      FACTOR_SPIRAL_GROWTH *
      (Math.asinh(phi_spiral) + phi_spiral * Math.sqrt(phi_spiral ** 2 + 1))

    let radius_spiral = RADIUS_SPIRAL_START
    const maxIterations = Math.min(maxBlocksPerSpiral, spiralData.length)

    for (let i = 0; i < maxIterations; i++) {
      const currentBlock = spiralData[i]
      const timeDifference = currentBlock?.[8]?.time_difference ?? 0
      const size = currentBlock?.[5]?.size ?? 0
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
        rotation: phi_spiral,
        color: `rgb(${brightness},${brightness},${brightness})`,
        timeDifference,
        height: currentBlock?.[0]?.height || null
      })
    }
    return blocks
  }, [loading, data]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchBlockDetails = async () => {
      if (selectedBlock === null) return

      const block = spiralBlocks[selectedBlock.blockIndex]
      if (!block || !block.height) {
        throw new Error('Height not found for selected block')
      }

      const urlHeight = `https://mempool.space/api/block-height/${block.height}`
      setLoadingBlockDetails(true)
      setBlockDetails(null)

      try {
        const resHeight = await fetch(urlHeight)
        const hash = await resHeight.text()

        const urlBlock = `https://mempool.space/api/block/${hash}`
        const resBlock = await fetch(urlBlock)
        const data = await resBlock.json()

        setBlockDetails(data)
      } catch (error) {
        throw new Error('Error fetching block details:' + error)
      } finally {
        setLoadingBlockDetails(false)
      }
    }

    fetchBlockDetails()
  }, [selectedBlock, spiralBlocks])

  useEffect(() => {
    setInputValue(String(currentFileIndex)) // Sync input field when index changes
  }, [currentFileIndex])

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
      {/* Top container with text */}
      <View style={styles.topContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text
            style={{ color: 'white', fontSize: 28, fontFamily: 'SF Pro Text' }}
          >
            ~0.0 mins
          </Text>
          <Text
            style={{ color: 'white', fontSize: 28, fontFamily: 'SF Pro Text' }}
          >
            ~0 days
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 5
          }}
        >
          <Text
            style={{ color: '#aaa', fontSize: 14, fontFamily: 'SF Pro Text' }}
          >
            Avg Block
          </Text>
          <Text
            style={{ color: '#aaa', fontSize: 14, fontFamily: 'SF Pro Text' }}
          >
            Adjustment Time
          </Text>
        </View>
      </View>

      {/* Main canvas with spiral blocks */}
      <Canvas
        style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}
      >
        {spiralBlocks.map((block, index) => {
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

          return <Path key={index} path={path} color={block.color} />
        })}

        {RADIUS_WEEKS.map((r, index) => {
          const myColor = `rgb(${255 - index * 50}, ${255 - index * 50}, ${255 - index * 50})`
          return (
            <Circle
              key={index}
              cx={canvasWidth / 2}
              cy={canvasHeight / 2}
              r={r}
              color="transparent"
            >
              <Paint color={myColor} style="stroke" strokeWidth={1}>
                <DashPathEffect intervals={[5, 5]} phase={0} />
              </Paint>
            </Circle>
          )
        })}

        <Paragraph paragraph={pWeek1} x={0} y={220} width={canvasWidth} />
        <Paragraph paragraph={pWeek2} x={0} y={170} width={canvasWidth} />
        <Paragraph paragraph={pWeek3} x={0} y={110} width={canvasWidth} />
        <Paragraph paragraph={pWeek4} x={0} y={60} width={canvasWidth} />
      </Canvas>

      {/* Overlay for touchable areas to detect block clicks */}
      <Animated.View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {spiralBlocks.map((block, index) => (
          <TouchableOpacity
            key={index}
            style={{
              position: 'absolute',
              top:
                CANVAS_TOP_OFFSET + canvasHeight / 2 + block.y - BLOCK_SIZE / 2,
              left: block.x - BLOCK_SIZE / 2,
              width: BLOCK_SIZE + 3,
              height: BLOCK_SIZE + 3,
              borderRadius: 25,
              backgroundColor: 'rgba(255, 255, 255, 0)'
            }}
            onPress={() => handleBlockPress(index)}
            onPressIn={() => handlePressIn(index)}
            onPressOut={() => handlePressOut(index)}
          />
        ))}
      </Animated.View>

      <TextInput
        style={{
          position: 'absolute',
          bottom: 100,
          backgroundColor: '#222',
          color: 'white',
          borderWidth: 1,
          borderColor: '#555',
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 5,
          width: 100,
          height: 40,
          textAlign: 'center',
          fontSize: 18
        }}
        value={inputValue}
        onChangeText={setInputValue}
        keyboardType="numeric"
        placeholder="Enter ID"
        placeholderTextColor="#888"
        textAlign="center"
      />

      <SSButton
        style={{ height: 20, width: 100, position: 'absolute', bottom: 80 }}
        label="Fetch"
        variant="gradient"
        onPress={() => {
          const parsed = parseInt(inputValue, 10)
          if (!isNaN(parsed)) {
            onChangeFileIndex(parsed)
          }
        }}
      />

      <View style={styles.buttonContainer}>
        <SSIconButton
          onPress={() => onChangeFileIndex(Math.max(currentFileIndex - 1, 0))}
          style={styles.chevronButton}
        >
          <SSIconChevronLeft height={22} width={24} />
        </SSIconButton>

        <View style={styles.bottomText}>
          <Text
            style={{ color: 'white', fontSize: 14, fontFamily: 'SF Pro Text' }}
          >
            000000-000000
          </Text>
          <Text
            style={{ color: '#888', fontSize: 12, fontFamily: 'SF Pro Text' }}
          >
            01-10 January, 2020
          </Text>
        </View>

        <SSIconButton
          onPress={() => onChangeFileIndex(currentFileIndex + 1)}
          style={styles.chevronButton}
        >
          <SSIconChevronRight height={22} width={24} />
        </SSIconButton>
      </View>

      {selectedBlock && (
        <View style={styles.overlay}>
          {loadingBlockDetails ? (
            <Text style={styles.overlayText}>Loading block details...</Text>
          ) : (
            <>
              <Canvas style={styles.overlayCanvas}>
                <Rect x={50} y={50} width={100} height={100} color="white" />
              </Canvas>
              <Text style={styles.overlayText}>
                Block ID: {blockDetails?.id}
                {'\n'}
                Height: {blockDetails?.height}
                {'\n'}
                Difficulty: {blockDetails?.difficulty}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setSelectedBlock(null)
                  setBlockDetails(null)
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
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

  const f = (t: number, L: number, k: number): number => {
    return t ** 2 - L * k
  }

  const df = (t: number): number => {
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
  topContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 10,
    position: 'absolute',
    top: 80
  },
  floatingContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000'
  },
  canvas: {
    backgroundColor: '#000',
    position: 'absolute',
    top: CANVAS_TOP_OFFSET
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0
  },
  bottomText: {
    alignItems: 'center',
    marginHorizontal: 16,
    minWidth: 150,
    borderWidth: 1
  },

  chevronButton: {
    height: 80,
    width: 80,
    borderWidth: 0.5,
    borderColor: '#888',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
  input: {
    backgroundColor: '#222',
    color: 'white',
    borderWidth: 1,
    borderColor: '#555',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 5,
    width: 100,
    textAlign: 'center',
    fontSize: 18
  }
})

export default SSSpiralBlocks
