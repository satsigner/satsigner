import * as d3 from 'd3'
import { useCallback, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler'
import Svg, {
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText
} from 'react-native-svg'

export type BalanceChartData = {
  memo: string
  date: Date
  amount: number
  type: 'send' | 'receive'
}

function SSBalanceChart({ data }: { data: BalanceChartData[] }) {
  const margin = { top: 30, right: 30, bottom: 60, left: 40 }
  const [containerSize, setContainersize] = useState({ width: 0, height: 0 })

  const [scale, setScale] = useState<number>(1) // Zoom scale
  const [translateX, setTranslateX] = useState<number>(0) // Pan offset
  const [translateY, setTranslateY] = useState<number>(0)
  const [cursorX, setCursorX] = useState<Date | undefined>(undefined)
  const [cursorY, setCursorY] = useState<number | undefined>(undefined)

  const chartWidth = containerSize.width - margin.left - margin.right
  const chartHeight = containerSize.height - margin.top - margin.bottom

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.date) as [Date, Date])
    .range([0, chartWidth])

  const yScale = d3
    .scaleLinear()
    .domain([
      d3.min(data, (d) => d.amount) ?? 0,
      (d3.max(data, (d) => d.amount) ?? 0) * 1.2
    ])
    .range([chartHeight, 0])

  const transformedXScale = xScale.copy().domain(
    xScale
      .range()
      .map((d) => (d - translateX) / scale)
      .map(xScale.invert)
  )

  const transformedYScale = yScale.copy().domain(
    yScale
      .range()
      .map((d) => (d - translateY) / scale)
      .map(yScale.invert)
  )

  const zoomPanGesture = Gesture.Pan()
    .onUpdate((event) => {
      setTranslateX((prev) =>
        Math.min(
          Math.max(prev + event.translationX, -chartWidth * (scale - 1)),
          0
        )
      )
      setTranslateY((prev) =>
        Math.min(
          Math.max(prev + event.translationY, -chartHeight * (scale - 1)),
          0
        )
      )
    })
    .runOnJS(true)

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = Math.min(Math.max(scale * event.scale, 1), 3)
      setScale(newScale)
    })
    .runOnJS(true)

  const longPressGesture = Gesture.LongPress()
    .onEnd((e, success) => {
      if (success) {
        const locationX = e.x
        const x = locationX - margin.left
        if (x >= 0 && x <= chartWidth) {
          const selectedDate = transformedXScale.invert(x)
          setCursorX(selectedDate)
          const index = data.findIndex((d) => d.date > selectedDate) - 1
          if (index >= 0) {
            setCursorY(data[index].amount)
          }
        }
      }
    })
    .runOnJS(true)

  const combinedGesture = Gesture.Simultaneous(
    pinchGesture,
    zoomPanGesture,
    longPressGesture
  )

  const lineGenerator = d3
    .line<BalanceChartData>()
    .x((d) => transformedXScale(d.date))
    .y((d) => transformedYScale(d.amount))
    .curve(d3.curveStepAfter)

  const areaGenerator = d3
    .area<BalanceChartData>()
    .x((d) => transformedXScale(d.date))
    .y0(chartHeight * scale)
    .y1((d) => transformedYScale(d.amount))
    .curve(d3.curveStepAfter)

  const linePath = lineGenerator(data)
  const areaPath = areaGenerator(data)

  const yAxisFormatter = d3.format('.2s')
  const cursorFormatter = d3.format(',d')

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainersize({ width, height })
  }, [])

  if (!containerSize.width || !containerSize.height) {
    return <View onLayout={handleLayout} style={styles.container} />
  }

  let previousDate: string = ''

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={combinedGesture}>
        <View style={styles.container} onLayout={handleLayout}>
          <Svg width={containerSize.width} height={containerSize.height}>
            {/* Axes and Grid */}
            <G x={margin.left} y={margin.top}>
              {transformedYScale.ticks(5).map(
                (tick) =>
                  transformedYScale(tick) <= chartHeight && (
                    <G
                      key={tick.toString()}
                      transform={`translate(0, ${transformedYScale(tick)})`}
                    >
                      <Line
                        x1={0}
                        x2={chartWidth}
                        y1={0}
                        y2={0}
                        stroke="#FFFFFF29"
                        strokeDasharray="2 2"
                      />
                      <SvgText
                        x={-10}
                        y={0}
                        textAnchor="end"
                        fontSize={10}
                        fill="white"
                      >
                        {yAxisFormatter(tick)}
                      </SvgText>
                    </G>
                  )
              )}
              {transformedXScale.ticks(4).map((tick) => {
                const currentDate = d3.timeFormat('%b %d')(tick)
                const displayTime = previousDate === currentDate
                previousDate = currentDate
                return (
                  <G
                    key={tick.toString()}
                    transform={`translate(${transformedXScale(tick)}, 0)`}
                  >
                    <Line
                      x1={0}
                      x2={0}
                      y1={0}
                      y2={chartHeight}
                      stroke="#FFFFFF29"
                      strokeDasharray="2 2"
                    />
                    <SvgText
                      x={0}
                      y={chartHeight + 20}
                      dy=".71em"
                      fontSize={10}
                      fill="#777777"
                      textAnchor="middle"
                    >
                      {displayTime
                        ? d3.timeFormat('%b %d %H:%M')(tick)
                        : currentDate}
                    </SvgText>
                  </G>
                )
              })}
              <Defs>
                <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <Stop offset="100%" stopColor="white" stopOpacity="0.03" />
                </LinearGradient>
                <ClipPath id="clip">
                  <Rect x="0" y="0" width={chartWidth} height={chartHeight} />
                </ClipPath>
              </Defs>
              {/* Chart Line */}
              <G clipPath="url(#clip)">
                <Path
                  d={linePath ?? ''}
                  fill="none"
                  stroke="white"
                  strokeWidth={2}
                />
                <Path d={areaPath ?? ''} fill="url(#gradient)" />
                {data.map((d, index) => (
                  <SvgText
                    key={index}
                    x={transformedXScale(d.date) + 10}
                    y={transformedYScale(d.amount) - 10}
                    textAnchor="middle"
                    fontSize={10 * scale}
                    fill={d.type === 'receive' ? '#A7FFAF' : '#FF7171'}
                  >
                    {d.memo || 'Test'}
                  </SvgText>
                ))}
                {cursorX !== undefined && (
                  <G>
                    <Line
                      x1={transformedXScale(cursorX)}
                      x2={transformedXScale(cursorX)}
                      y1={20}
                      y2={chartHeight}
                      stroke="white"
                      strokeDasharray="10 2"
                    />
                    <SvgText
                      x={transformedXScale(cursorX) - 10}
                      y={10}
                      textAnchor="middle"
                      fontSize={12}
                      fill="white"
                    >
                      {cursorFormatter(cursorY ?? 0)}
                    </SvgText>
                  </G>
                )}
              </G>
            </G>
          </Svg>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1
  }
})

export default SSBalanceChart
