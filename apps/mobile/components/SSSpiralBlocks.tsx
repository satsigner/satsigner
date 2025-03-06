import React, { useState, useEffect, useMemo } from 'react'
import SSButton from '@/components/SSButton'
import {
  Canvas,
  Rect,
  Circle,
  Skia,
  Path,
  Paint,
  DashPathEffect,
  useFonts,
  TextAlign,
  Paragraph
} from '@shopify/react-native-skia'
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Dimensions,
  ViewStyle,
  StyleProp
} from 'react-native'
import Animated from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import SSIconButton from '@/components/SSIconButton'
import {
  SSIconChevronUp,
  SSIconChevronDown,
  SSIconChevronLeft,
  SSIconChevronRight
} from '@/components/icons'
import { Colors } from '@/styles'

// Constants
const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
console.log(`Screenwidth: ${screenWidth} Screenheight: ${screenHeight}`)
const maxBlocksPerSpiral: number = 216 // 2016
const factorBlockDistance: number = 0.04
const radiusSpiralStart: number = 1
const factorSpiralGrowth: number = 0.8
const canvasWidth = screenWidth // Canvas dimensions
const canvasHeight = 650
const blockSize = 3 // Block size in pixels
const maxLoggingBlock = 10
const debugLog = true
const radiusWeeks = [110, 160, 220, 270]
const canvasTopOffset = 140

// color
const min_brightness: number = 20
const maxBrightnessSize: number = 5000

const dataLink = 'https://pvxg.net/bitcoin_data/difficulty_epochs/'

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

  const df = (t: number, k: number): number => {
    return 2 * t
  }

  for (let i = 0; i < maxIterations; i++) {
    const f_t = f(t, L, k)
    const df_t = df(t, k)

    if (Math.abs(f_t) < tolerance) {
      return t
    }

    t = t - f_t / df_t
  }

  throw new Error('Convergence Failed!')
}

// Logic for files
const getFileName = (index: number) => {
  return `rcp_bitcoin_block_data_${(index * maxBlocksPerSpiral)
    .toString()
    .padStart(7, '0')}.json`
}

export default function SSSpiralBlocks() {
  // State for handling pressed blocks (for opacity effect)
  const [pressedBlocks, setPressedBlocks] = useState<{
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

  /* const handleBlockPress = (index: number) => {
    const block = spiralBlocks[index]
    const height = block?.height || 675

    if (!height) {
      console.error('Block height not found, using fallback height of 675')
    }
    console.log(1111)
    // Navigate to exploreBlock page with the height as parameter.
    router.push(`explorer/block?height=${height}` as any)
  }*/

  const handleBlockPress = (index: number) => {
    const block = spiralBlocks[index]
    const height = block?.height || 675

    if (!height) {
      console.error('Block height not found, using fallback height of 675')
    }

    console.log('Navigating to SSExploreBlock with height:', height)

    router.push({
      pathname: 'explorer/explorerViews',
      params: { view: 'block', height }
    } as any)
  }

  // State for fetching data
  const [spiralDataRaw, setSpiralDataRaw] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [inputValue, setInputValue] = useState(String(currentFileIndex)) // Sync input with state

  const router = useRouter()

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
  const dateText = '1 WEEK'

  const TextStyleWeeks = {
    color: Skia.Color(Colors.gray[100]),
    fontFamilies: ['SF Pro Text'],
    fontSize: fontSize,
    fontStyle: {
      weight: 400
    }
  }

  const createParagraph = (text: string) => {
    if (!customFontManager) return null

    const para = Skia.ParagraphBuilder.Make({
      maxLines: 1,
      textAlign: TextAlign.Center
    })
      .pushStyle(TextStyleWeeks)
      .addText(text)
      .pop()
      .build()

    para.layout(100)
    return para
  }
  const pWeek1 = useMemo(() => createParagraph('1 WEEK'), [customFontManager])
  const pWeek2 = useMemo(() => createParagraph('2 WEEKS'), [customFontManager])
  const pWeek3 = useMemo(() => createParagraph('3 WEEKS'), [customFontManager])
  const pWeek4 = useMemo(() => createParagraph('4 WEEKS'), [customFontManager])

  const fetchData = async () => {
    setLoading(true)
    try {
      const fileName = getFileName(currentFileIndex)
      const response = await fetch(dataLink + fileName)
      const data = await response.json()
      setSpiralDataRaw(data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentFileIndex])

  const spiralBlocks = useMemo(() => {
    if (!spiralDataRaw || spiralDataRaw.length === 0) return []

    var spiralData = spiralDataRaw[0]
    if (debugLog) console.log('Loaded Data:', spiralData)

    const blocks = []
    var phi_spiral = radiusSpiralStart / factorSpiralGrowth
    var arc_distance =
      factorSpiralGrowth *
      (Math.asinh(phi_spiral) + phi_spiral * Math.sqrt(phi_spiral ** 2 + 1))

    let radius_spiral = radiusSpiralStart
    const maxIterations = Math.min(maxBlocksPerSpiral, spiralData.length)

    for (let i = 0; i < maxIterations; i++) {
      const currentBlock = spiralData[i]
      const timeDifference = currentBlock?.[8]?.time_difference ?? 0
      const size = currentBlock?.[5]?.size ?? 0
      const block_distance =
        i === 0 || i === maxBlocksPerSpiral - 1 ? 0 : timeDifference

      arc_distance += block_distance * factorBlockDistance
      phi_spiral = newtonRaphson(arc_distance, factorSpiralGrowth, phi_spiral)
      radius_spiral = factorSpiralGrowth * phi_spiral

      const x = radius_spiral * Math.cos(phi_spiral)
      const y = radius_spiral * Math.sin(phi_spiral)
      const logMin = Math.log(1)
      const logMax = Math.log(maxBrightnessSize)
      let brightness = min_brightness + (size / maxBrightnessSize) * 256

      if (debugLog) {
        if (i < maxLoggingBlock)
          console.log(
            `Block: ${i} x: ${x} y: ${y} phi ${phi_spiral}  td: ${timeDifference} size: ${size} brght: ${brightness} `
          )
        if (i == maxLoggingBlock) console.log('(...)')
      }
      blocks.push({
        x,
        y,
        rotation: phi_spiral,
        color: `rgb(${brightness},${brightness},${brightness})`,
        timeDifference,
        height: currentBlock?.[0]?.height || null
      })
    }
    if (debugLog) console.log('Spiral Blocks:', blocks)
    return blocks
  }, [loading, spiralDataRaw])

  useEffect(() => {
    if (selectedBlock !== null) {
      // Get the selected block from spiralBlocks array
      const block = spiralBlocks[selectedBlock.blockIndex]
      if (!block || !block.height) {
        console.error('Height not found for selected block')
        return
      }
      // Build the URL for block hash using the block's height
      const urlHeight = `https://mempool.space/api/block-height/${block.height}`
      setLoadingBlockDetails(true)
      setBlockDetails(null)
      fetch(urlHeight)
        .then((res) => res.text()) // Expecting plain text containing the block hash
        .then((hash) => {
          const urlBlock = `https://mempool.space/api/block/${hash}`
          return fetch(urlBlock)
        })
        .then((res) => res.json())
        .then((data) => {
          setBlockDetails(data)
        })
        .catch((error) => {
          console.error('Error fetching block details:', error)
        })
        .finally(() => {
          setLoadingBlockDetails(false)
        })
    }
  }, [selectedBlock, spiralBlocks])

  useEffect(() => {
    setInputValue(String(currentFileIndex)) // Sync input field when index changes
  }, [currentFileIndex])

  // If still loading data, show a loading spinner (an outlined circle)
  if (loading) {
    return (
      <View style={styles.container}>
        <Canvas style={styles.canvas}>
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
      <Canvas style={styles.canvas}>
        {spiralBlocks.map((block, index) => {
          const path = Skia.Path.Make()
          const halfSize = blockSize / 2
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

        {radiusWeeks.map((r, index) => {
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
        <Paragraph paragraph={pWeek3} x={0} y={170} width={canvasWidth} />
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
              top: canvasTopOffset + canvasHeight / 2 + block.y - blockSize / 2,
              left: block.x - blockSize / 2,
              width: blockSize + 3,
              height: blockSize + 3,
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
          textAlign: 'center', // Centers text inside the input field
          fontSize: 18
        }}
        value={inputValue}
        onChangeText={setInputValue} // Allows typing freely
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
            setCurrentFileIndex(parsed) // Only update state if input is valid
          }
        }}
      />

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        <SSIconButton
          onPress={() => {
            setLoading(true)
            setCurrentFileIndex((prevIndex) => Math.max(prevIndex - 1, 0))
          }}
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
          onPress={() => {
            setLoading(true)
            setCurrentFileIndex((prevIndex) => prevIndex + 1)
          }}
          style={styles.chevronButton}
        >
          <SSIconChevronRight height={22} width={24} />
        </SSIconButton>
      </View>

      {/* Overlay view for when a block is clicked */}
      {selectedBlock && (
        <View style={styles.overlay}>
          {loadingBlockDetails ? (
            // While block details are loading, show a message
            <Text style={styles.overlayText}>Loading block details...</Text>
          ) : (
            <>
              {/* New canvas with a simple cube */}
              <Canvas style={styles.overlayCanvas}>
                <Rect x={50} y={50} width={100} height={100} color="white" />
              </Canvas>
              {/* Display some of the fetched block details */}
              <Text style={styles.overlayText}>
                Block ID: {blockDetails?.id}
                {'\n'}
                Height: {blockDetails?.height}
                {'\n'}
                Difficulty: {blockDetails?.difficulty}
              </Text>
              {/* Close button */}
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

// Styles
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
    width: canvasWidth,
    height: canvasHeight,
    backgroundColor: '#000',
    position: 'absolute',
    top: canvasTopOffset
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)', // semi-transparent dark overlay
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    padding: 20
  },
  overlayCanvas: {
    width: 200,
    height: 200,
    backgroundColor: '#000', // or transparent if you prefer
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
    textAlign: 'center', // Centers text inside the input field
    fontSize: 18
  }
})
