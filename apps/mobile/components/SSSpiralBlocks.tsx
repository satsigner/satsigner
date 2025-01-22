import React, { useState, useEffect, useMemo } from 'react'
import { Canvas, Rect, Circle, Skia, Path } from '@shopify/react-native-skia'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import SSIconButton from '@/components/SSIconButton'
import {
  SSIconChevronUp,
  SSIconChevronDown,
  SSIconChevronLeft,
  SSIconChevronRight
} from '@/components/icons'

// Constants
const maxBlocksPerSpiral: number = 2016
const factorBlockDistance: number = 0.04
const radiusSpiralStart: number = 1
const factorSpiralGrowth: number = 0.8
const canvasSize = 500 // Canvas dimensions
const blockSize = 3 // Block size in pixels
const maxLoggingBlock = 10

// color
const min_brightness: number = 20
const maxBrightnessSize: number = 5000

const dataLink = 'https://pvxg.net/bitcoin_data/difficulty_epochs/'
const dataFile = 'rcp_bitcoin_block_data_0006048.json'

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

    console.log('Loaded Data:', spiralData) // Log the data before calculations

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

      if (i < maxLoggingBlock)
        console.log(
          `Block: ${i} x: ${x} y: ${y} phi ${phi_spiral}  td: ${timeDifference} size: ${size} brght: ${brightness} `
        )
      if (i == maxLoggingBlock) console.log('(...)')

      // Add the block to the array
      blocks.push({
        x,
        y,
        rotation: phi_spiral, // Rotation for debugging
        color: `rgb(${brightness},${brightness},${brightness})`, // Grayscale tint based on index
        timeDifference // Store time_difference for debugging or further use
      })
    }

    console.log('Spiral Blocks:', blocks) // Debugging output

    return blocks
  }, [isDataLoaded, spiralDataRaw]) // Recompute when data or loading status changes

  if (!isDataLoaded) {
    return (
      <View style={styles.container}>
        <Canvas style={styles.canvas}>
          {/* Loading indication */}
          <Circle cx={canvasSize / 2} cy={canvasSize / 2} r={50} color="grey" />
        </Canvas>
      </View>
    )
  }

  return (
    <View style={styles.container}>
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
            points[0][0] + canvasSize / 2,
            points[0][1] + canvasSize / 2
          )
          path.lineTo(
            points[1][0] + canvasSize / 2,
            points[1][1] + canvasSize / 2
          )
          path.lineTo(
            points[2][0] + canvasSize / 2,
            points[2][1] + canvasSize / 2
          )
          path.lineTo(
            points[3][0] + canvasSize / 2,
            points[3][1] + canvasSize / 2
          )
          path.close()

          return <Path key={index} path={path} color={block.color} />
        })}
      </Canvas>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        <SSIconButton
          onPress={() =>
            setCurrentFileIndex((prevIndex) => Math.max(prevIndex - 1, 0))
          }
        >
          <SSIconChevronLeft height={22} width={24} />
        </SSIconButton>

        <SSIconButton
          onPress={() => setCurrentFileIndex((prevIndex) => prevIndex + 1)}
        >
          <SSIconChevronRight height={22} width={24} />
        </SSIconButton>
      </View>
    </View>
  )
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000' // Black background
  },
  canvas: {
    width: canvasSize, // Canvas width
    height: canvasSize, // Canvas height
    backgroundColor: '#000000' // Black canvas background
  },

  buttonContainer: {
    flexDirection: 'row', // Align buttons horizontally
    justifyContent: 'center', // Center buttons horizontally
    alignItems: 'center', // Center buttons vertically
    marginTop: 16 // Optional margin between the canvas and the buttons
  }
})
