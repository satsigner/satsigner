import { useMemo, useState } from 'react'
import { type LayoutChangeEvent, View } from 'react-native'
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg'

const RADIUS_INDICATOR = 8
const RADIUS_INNER_RECT = 13
const RADIUS_OUTER_RECT = 16

type SSMultiSigCountViewProps = {
  maxCount: number
  totalCount: number
  requiredCount: number
}

function SSMultisigCountView({
  maxCount,
  totalCount,
  requiredCount
}: SSMultiSigCountViewProps) {
  const [containerSize, setContainersize] = useState({ width: 0, height: 0 })

  const sizeBetweenPoints = useMemo(() => {
    return (containerSize.width - RADIUS_OUTER_RECT * 2) / (maxCount - 1)
  }, [containerSize.width, maxCount])

  const centerPoints = useMemo(() => {
    return Array.from({ length: maxCount }, (_, i) => i).map(
      (i) => sizeBetweenPoints * i + RADIUS_OUTER_RECT
    )
  }, [maxCount, sizeBetweenPoints])
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainersize({ width, height })
  }
  return (
    <View
      style={{
        backgroundColor: 'transparent',
        height: 60
      }}
      onLayout={handleLayout}
    >
      <Svg
        width={containerSize.width}
        height={60}
        pointerEvents="box-none"
        style={{ height: 60 }}
      >
        <G>
          {Array.from({ length: maxCount }, (_, i) => i).map((count) => (
            <SvgText
              key={count}
              x={centerPoints[count]}
              y={10}
              fill={
                count + 1 > totalCount
                  ? '#FFFFFF17'
                  : count + 1 === totalCount
                    ? 'white'
                    : count + 1 === requiredCount
                      ? 'white'
                      : '#FFFFFF33'
              }
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
            width={containerSize.width - RADIUS_OUTER_RECT * 2}
            height={RADIUS_OUTER_RECT * 2}
            fill="black"
          />
          <Circle
            cx={containerSize.width - RADIUS_OUTER_RECT}
            cy={35}
            r={RADIUS_OUTER_RECT}
            fill="black"
          />
        </G>
        <G>
          <Circle
            cx={RADIUS_OUTER_RECT}
            cy={35}
            r={RADIUS_INNER_RECT}
            fill="#4A4A4A"
          />
          <Rect
            x={RADIUS_OUTER_RECT}
            y={35 - RADIUS_INNER_RECT}
            width={sizeBetweenPoints * (totalCount - 1)}
            height={RADIUS_INNER_RECT * 2}
            fill="#4A4A4A"
          />
          <Circle
            cx={sizeBetweenPoints * (totalCount - 1) + RADIUS_OUTER_RECT}
            cy={35}
            r={RADIUS_INNER_RECT}
            fill="#4A4A4A"
          />
        </G>
        <G>
          <Circle
            cx={RADIUS_OUTER_RECT}
            cy={35}
            r={RADIUS_INNER_RECT}
            fill="#BFBFBF"
          />
          <Rect
            x={RADIUS_OUTER_RECT}
            y={35 - RADIUS_INNER_RECT}
            width={sizeBetweenPoints * (requiredCount - 1)}
            height={RADIUS_INNER_RECT * 2}
            fill="#BFBFBF"
          />
          <Circle
            cx={sizeBetweenPoints * (requiredCount - 1) + RADIUS_OUTER_RECT}
            cy={35}
            r={RADIUS_INNER_RECT}
            fill="#BFBFBF"
          />
        </G>
        <G>
          {Array.from({ length: maxCount }, (_, i) => i).map((count) => (
            <Circle
              key={count}
              cx={centerPoints[count]}
              cy={35}
              r={RADIUS_INDICATOR}
              strokeWidth={1}
              stroke={count + 1 <= totalCount ? 'white' : 'transparent'}
              fill={
                count + 1 > totalCount
                  ? '#242424'
                  : count + 1 === totalCount
                    ? 'white'
                    : count + 1 === requiredCount
                      ? 'white'
                      : 'transparent'
              }
            />
          ))}
        </G>
      </Svg>
    </View>
  )
}

export default SSMultisigCountView
