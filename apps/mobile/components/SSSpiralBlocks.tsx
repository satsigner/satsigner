import React, { useState, useEffect, useMemo } from 'react'
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
import { StyleSheet, View, Text, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import SSIconButton from '@/components/SSIconButton'
import {
  SSIconChevronUp,
  SSIconChevronDown,
  SSIconChevronLeft,
  SSIconChevronRight
} from '@/components/icons'
import { color, rgb } from 'd3'
import { Colors } from '@/styles'

// Constants
const maxBlocksPerSpiral: number = 2016
const factorBlockDistance: number = 0.04
const radiusSpiralStart: number = 1
const factorSpiralGrowth: number = 0.8
const canvasWidth = 500 // Canvas dimensions
const canvasHeight = 650
const blockSize = 3 // Block size in pixels
const maxLoggingBlock = 10
const debugLog = false
const radiusWeeks = [110, 160, 220, 270]

// color
const min_brightness: number = 20
const maxBrightnessSize: number = 5000

const dataLink = 'https://pvxg.net/bitcoin_data/difficulty_epochs/'
//const dataFile = 'rcp_bitcoin_block_data_0006048.json'

/**
 * Newton-Raphson method to find roots of a function
 * @param L Parameter for the function f
 * @param k Parameter for the function f
 * @param initialGuess Initial guess for the solution
 * @param tolerance Tolerance for convergence
 * @param maxIterations Maximum number of iterations
 * @returns The root of the function
 */
function newtonRaphson(
  L: number,
  k: number,
  initialGuess: number = 1.0,
  tolerance: number = 1e-6,
  maxIterations: number = 1000
): number {
  let t = initialGuess

  // Define the function `f` and its derivative `df` (placeholders)
  const f = (t: number, L: number, k: number): number => {
    return t ** 2 - L * k // Replace this with the actual function
  }

  const df = (t: number, k: number): number => {
    return 2 * t // Replace this with the actual derivative
  }

  for (let i = 0; i < maxIterations; i++) {
    const f_t = f(t, L, k) // Calculate f(t)
    const df_t = df(t, k) // Calculate f'(t)

    if (Math.abs(f_t) < tolerance) {
      return t // Convergence achieved
    }

    t = t - f_t / df_t // Update t
  }

  throw new Error('Convergence Failed!') // If max iterations are reached
}

// Logic for files
const getFileName = (index: number) => {
  return `rcp_bitcoin_block_data_${(index * maxBlocksPerSpiral).toString().padStart(7, '0')}.json`
}

export default function SSSpiralBlocks() {
  const [spiralDataRaw, setspiralDataRaw] = useState<any[]>([]) // State to store fetched data
  const [isDataLoaded, setIsDataLoaded] = useState(false) // State to track data loading status
  const [currentFileIndex, setCurrentFileIndex] = useState(0) // State for current file index
  const router = useRouter()

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
    try {
      const fileName = getFileName(currentFileIndex)
      const response = await fetch(dataLink + fileName)
      const data = await response.json()
      setspiralDataRaw(data)
      setIsDataLoaded(true)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentFileIndex]) // Fetch new data when current file index changes

  const spiralBlocks = useMemo(() => {
    if (!isDataLoaded) return [] // Don't compute if data isn't loaded

    var spiralData = spiralDataRaw[0]

    if (debugLog) console.log('Loaded Data:', spiralData) // Log the data before calculations

    const blocks = []

    // Initial values
    var phi_spiral = radiusSpiralStart / factorSpiralGrowth
    var arc_distance =
      factorSpiralGrowth *
      (Math.asinh(phi_spiral) + phi_spiral * Math.sqrt(phi_spiral ** 2 + 1))

    let radius_spiral = radiusSpiralStart // Start radius, only if non-Newton algorithm

    const maxIterations = Math.min(maxBlocksPerSpiral, spiralData.length)

    for (let i = 0; i < maxIterations; i++) {
      // Extract time_difference from spiralData
      const currentBlock = spiralData[i]
      const timeDifference = currentBlock?.[8]?.time_difference ?? 0 // Safely access and fallback to 0 if undefined
      const size = currentBlock?.[5]?.size ?? 0 // Safely access and fallback to 0 if undefined

      const block_distance =
        i === 0 || i === maxBlocksPerSpiral - 1
          ? 0 // No distance for the first and last block
          : timeDifference // Factor to determine distance between blocks

      // Update spiral radius and angle
      arc_distance += block_distance * factorBlockDistance
      phi_spiral = newtonRaphson(arc_distance, factorSpiralGrowth, phi_spiral)
      radius_spiral = factorSpiralGrowth * phi_spiral

      // Calculate x and y positions
      const x = radius_spiral * Math.cos(phi_spiral)
      const y = radius_spiral * Math.sin(phi_spiral)
      const logMin = Math.log(1) // Avoid log(0), so we take log(1) as the minimum
      const logMax = Math.log(maxBrightnessSize) // Logarithmic max value

      // Calculate brightness using logarithmic scaling
      //let brightness = min_brightness + ((Math.log(size + 1) - logMin) / (logMax - logMin)) *(256 - min_brightness)
      let brightness = min_brightness + (size / maxBrightnessSize) * 256

      if (debugLog) {
        if (i < maxLoggingBlock)
          console.log(
            `Block: ${i} x: ${x} y: ${y} phi ${phi_spiral}  td: ${timeDifference} size: ${size} brght: ${brightness} `
          )
        if (i == maxLoggingBlock) console.log('(...)')
      }
      // Add the block to the array
      blocks.push({
        x,
        y,
        rotation: phi_spiral, // Rotation for debugging
        color: `rgb(${brightness},${brightness},${brightness})`, // Grayscale tint based on index
        timeDifference // Store time_difference for debugging or further use
      })
    }

    if (debugLog) console.log('Spiral Blocks:', blocks) // Debugging output

    return blocks
  }, [isDataLoaded, spiralDataRaw]) // Recompute when data or loading status changes

  if (!isDataLoaded) {
    return (
      <View style={styles.container}>
        <Canvas style={styles.canvas}>
          {/* Loading indication */}
          <Circle
            cx={canvasWidth / 2}
            cy={canvasHeight / 2}
            r={50}
            color="red"
          />
        </Canvas>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.topContainer}>
        {/* First row */}
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

        {/* Second row */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 5
          }}
        >
          <Text
            style={{
              color: '#aaa',
              fontSize: 14,
              fontFamily: 'SF Pro Text'
            }}
          >
            Avg Block
          </Text>
          <Text
            style={{
              color: '#aaa',
              fontSize: 14,
              fontFamily: 'SF Pro Text'
            }}
          >
            Adjustment Time
          </Text>
        </View>
      </View>

      <Canvas style={styles.canvas}>
        {spiralBlocks.map((block, index) => {
          const path = Skia.Path.Make()
          const halfSize = blockSize / 2

          // Define points of a rotated rectangle
          const cosTheta = Math.cos(block.rotation)
          const sinTheta = Math.sin(block.rotation)

          const points = [
            [-halfSize, -halfSize],
            [halfSize, -halfSize],
            [halfSize, halfSize],
            [-halfSize, halfSize]
          ].map(([x, y]) => {
            // Apply rotation manually
            const rotatedX = cosTheta * x - sinTheta * y
            const rotatedY = sinTheta * x + cosTheta * y
            return [rotatedX + block.x, rotatedY + block.y]
          })

          // Create the path for the rotated rectangle
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

        {/*<Text x={0} y={fontSize} text="Hello World" font={font} />*/}
        <Paragraph paragraph={pWeek1} x={0} y={220} width={canvasWidth} />
        <Paragraph paragraph={pWeek3} x={0} y={170} width={canvasWidth} />
        <Paragraph paragraph={pWeek3} x={0} y={110} width={canvasWidth} />
        <Paragraph paragraph={pWeek4} x={0} y={60} width={canvasWidth} />
      </Canvas>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        <SSIconButton
          onPress={() =>
            setCurrentFileIndex((prevIndex) => Math.max(prevIndex - 1, 0))
          }
          style={styles.chevronButton}
        >
          <SSIconChevronLeft height={22} width={24} />
        </SSIconButton>

        <View style={{ alignItems: 'center', marginHorizontal: 16 }}>
          <Text
            style={{
              color: 'white',
              fontSize: 20,
              fontWeight: 'bold',
              fontFamily: 'SF Pro Text'
            }}
          >
            000
          </Text>
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
          onPress={() => setCurrentFileIndex((prevIndex) => prevIndex + 1)}
          style={styles.chevronButton}
        >
          <SSIconChevronRight height={22} width={24} />
        </SSIconButton>
      </View>
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
    position: 'absolute', // Allows overlapping
    bottom: 20, // Adjusts how far from the bottom it is
    left: 0,
    right: 0,
    alignItems: 'center' // Centers content horizontally
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000' // Black background
  },
  canvas: {
    width: canvasWidth, // Canvas width
    height: canvasHeight, // Canvas height
    backgroundColor: '#000', // Black canvas background
    position: 'absolute', // Allows overlapping
    bottom: 20 // Adjusts how far from the bottom it is
  },

  buttonContainer: {
    flexDirection: 'row', // Align buttons horizontally
    justifyContent: 'center', // Center buttons horizontally
    alignItems: 'center', // Center buttons vertically
    marginTop: 16, // Optional margin between the canvas and the buttons
    position: 'absolute', // Allows overlapping
    bottom: 20, // Adjusts how far from the bottom it is
    left: 0,
    right: 0
  },
  chevronButton: {
    height: 80,
    width: 80,
    borderWidth: 0.5, // Border thickness
    borderColor: '#888', // Border color (greyish)
    borderRadius: 10, // Rounded corners
    justifyContent: 'center', // Center vertically
    alignItems: 'center', // Center horizontally
    marginHorizontal: 10 // Space between buttons
  }
})
