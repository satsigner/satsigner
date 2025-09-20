import { useMemo, useState } from 'react'
import { type LayoutChangeEvent, View } from 'react-native'
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg'

const RADIUS_INDICATOR = 8
const RADIUS_OUTER_RECT = 16
const MIN_CONTAINER_WIDTH = 80
const MAX_CONTAINER_WIDTH = 140

type SSSignatureRequiredDisplayProps = {
  requiredNumber: number
  totalNumber: number
  collectedSignatures?: number[] // Array of signature indices that have been collected (0-based)
}

function SSSignatureRequiredDisplay({
  requiredNumber,
  totalNumber,
  collectedSignatures = []
}: SSSignatureRequiredDisplayProps) {
  const [containerSize, setContainersize] = useState({ width: 0, height: 0 })

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainersize({ width, height })
  }

  const sizeBetweenPoints = useMemo(() => {
    if (totalNumber <= 1) return 0

    const availableWidth = Math.max(
      MIN_CONTAINER_WIDTH,
      Math.min(containerSize.width, MAX_CONTAINER_WIDTH)
    )
    const spacing = (availableWidth - RADIUS_OUTER_RECT * 2) / (totalNumber - 1)

    return Math.max(spacing, 15)
  }, [containerSize.width, totalNumber])

  const centerPoints = useMemo(() => {
    if (totalNumber <= 1) return [RADIUS_OUTER_RECT]

    return Array.from({ length: totalNumber }, (_, i) => i).map(
      (i) => sizeBetweenPoints * i + RADIUS_OUTER_RECT
    )
  }, [totalNumber, sizeBetweenPoints])

  const svgWidth = useMemo(() => {
    if (totalNumber <= 1) return MIN_CONTAINER_WIDTH

    const calculatedWidth =
      sizeBetweenPoints * (totalNumber - 1) + RADIUS_OUTER_RECT * 2
    return Math.max(
      MIN_CONTAINER_WIDTH,
      Math.min(calculatedWidth, MAX_CONTAINER_WIDTH)
    )
  }, [totalNumber, sizeBetweenPoints])

  return (
    <View
      style={{
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <View
        style={{
          backgroundColor: 'transparent',
          height: 80,
          width: svgWidth
        }}
        onLayout={handleLayout}
      >
        <Svg
          width={svgWidth}
          height={100}
          pointerEvents="none"
          style={{ height: 100 }}
        >
          <G>
            {Array.from({ length: totalNumber }, (_, i) => i).map((count) => (
              <SvgText
                key={count}
                x={centerPoints[count]}
                y={10}
                fill="white"
                fontSize={12}
                textAnchor="middle"
              >
                {count + 1}
              </SvgText>
            ))}
          </G>
          <G>
            <Circle
              cx={RADIUS_OUTER_RECT}
              cy={35}
              r={RADIUS_OUTER_RECT}
              fill="black"
            />
            <Rect
              x={RADIUS_OUTER_RECT}
              y={35 - RADIUS_OUTER_RECT}
              width={svgWidth - RADIUS_OUTER_RECT * 2}
              height={RADIUS_OUTER_RECT * 2}
              fill="black"
            />
            <Circle
              cx={svgWidth - RADIUS_OUTER_RECT}
              cy={35}
              r={RADIUS_OUTER_RECT}
              fill="black"
            />
          </G>
          <G>
            {Array.from({ length: totalNumber }, (_, i) => i).map((count) => {
              const isCollected = collectedSignatures.includes(count)
              const isRequired = count + 1 <= requiredNumber

              return (
                <Circle
                  key={count}
                  cx={centerPoints[count]}
                  cy={35}
                  r={RADIUS_INDICATOR}
                  strokeWidth={2}
                  stroke={isRequired ? 'white' : '#4F4F4F'}
                  opacity={0.9}
                  fill={isCollected ? '#A7FFAF' : 'transparent'}
                />
              )
            })}
          </G>
        </Svg>
      </View>
    </View>
  )
}

export default SSSignatureRequiredDisplay
