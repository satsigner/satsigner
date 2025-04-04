import {
  DashPathEffect,
  LinearGradient,
  useFont,
  vec
} from '@shopify/react-native-skia'
import React, { useMemo } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { Path, Svg } from 'react-native-svg'
import { CartesianChart, StackedArea } from 'victory-native'

import { type MempoolStatistics } from '@/types/models/Blockchain'

import SSText from './SSText'

const sansSerif = require('@/assets/fonts/SF-Pro-Text-Medium.otf')

const mVBLabels = ['18', '15', '12', '9', '6', '3', '0']

export type SSFeeRateChartProps = {
  mempoolStatistics: MempoolStatistics[] | undefined
  timeRange: 'week' | 'day' | '2hours'
  boxPosition?: Animated.Value
}

function SSFeeRateChart({
  mempoolStatistics,
  timeRange,
  boxPosition = new Animated.Value(0)
}: SSFeeRateChartProps) {
  const font = useFont(sansSerif, 12)
  const [, setW] = React.useState(0)
  const [, setH] = React.useState(0)

  const processData = useMemo(() => {
    if (!mempoolStatistics) return []

    return mempoolStatistics
      .map((entry) => {
        const date = new Date(entry.added * 1000)
        let timestamp
        if (timeRange === 'week') {
          timestamp = date.toLocaleDateString('en-US', {
            day: 'numeric'
          })
        } else if (timeRange === 'day') {
          timestamp = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h24',
            hour12: false
          })
        } else {
          timestamp = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h24',
            hour12: false
          })
        }
        const quarter = Math.floor(entry.vsizes.length / 4)

        // Group vsizes into fee ranges
        return {
          x: timestamp,
          high:
            entry.vsizes
              .slice(0, quarter)
              .reduce((sum, current) => sum + current, 0) / 1000000,
          medium:
            entry.vsizes
              .slice(quarter, 2 * quarter)
              .reduce((sum, current) => sum + current, 0) / 1000000,
          low:
            entry.vsizes
              .slice(2 * quarter, 3 * quarter)
              .reduce((sum, current) => sum + current, 0) / 1000000,
          veryLow:
            entry.vsizes
              .slice(3 * quarter)
              .reduce((sum, current) => sum + current, 0) / 1000000
        }
      })
      .reverse()
  }, [mempoolStatistics, timeRange])

  if (!mempoolStatistics)
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', padding: 16 }}>Loading chart...</Text>
      </View>
    )

  return (
    <View style={styles.container}>
      <CartesianChart
        data={processData}
        xKey="x"
        yKeys={['veryLow', 'low', 'medium', 'high']}
        padding={{ left: 8 }}
        domain={{ y: [0, 25] }}
        xAxis={{
          font,
          labelColor: '#787878',
          tickCount: 4,
          labelOffset: 4
        }}
        yAxis={[
          {
            labelOffset: 8,
            font: null,
            linePathEffect: <DashPathEffect intervals={[4, 4]} />,
            labelColor: '#fff'
          }
        ]}
        onChartBoundsChange={({ left, right, top, bottom }) => {
          setW(right - left)
          setH(bottom - top)
        }}
      >
        {({ points, chartBounds }) => (
          <StackedArea
            points={[points.high, points.medium, points.low, points.veryLow]}
            y0={chartBounds.bottom}
            curveType="natural"
            animate={{ type: 'spring' }}
            areaOptions={({ rowIndex, lowestY, highestY }) => {
              const gradients = [
                {
                  colors: ['#515151'],
                  start: highestY - 5,
                  end: 20
                },
                {
                  colors: ['#444343', '#f7ce6420'],
                  start: highestY - 25,
                  end: lowestY
                },
                {
                  colors: ['#8a8a8a', '#2e2e2e0'],
                  start: highestY - 100,
                  end: lowestY
                },
                {
                  colors: ['#c7c8c8', '#9d9e9e11'],
                  start: highestY - 100,
                  end: lowestY
                }
              ]

              const gradient = gradients[rowIndex]
              if (!gradient) return {}

              return {
                children: (
                  <LinearGradient
                    start={vec(0, gradient.start)}
                    end={vec(0, gradient.end)}
                    colors={gradient.colors}
                  />
                )
              }
            }}
          />
        )}
      </CartesianChart>
      <View style={styles.arrowContainer}>
        <Animated.View
          style={[
            styles.arrow,
            {
              transform: [
                {
                  translateY: boxPosition.interpolate({
                    inputRange: [1, 100],
                    outputRange: [0, -150],
                    extrapolate: 'clamp'
                  })
                }
              ]
            }
          ]}
        >
          <Svg
            style={styles.arrow}
            width="20"
            height="20"
            viewBox="0 0 15 15"
            fill="none"
          >
            <Path
              d="M-4.64163e-07 5.40065L5.9162 10.8013L11 11L11 9.53674e-07L5.9162 2.62584e-05L-4.64163e-07 5.40065Z"
              fill="white"
            />
          </Svg>
        </Animated.View>
        <View>
          {mVBLabels.map((label, index) => (
            <SSText
              style={{
                marginTop: 8
              }}
              size="xs"
              color="white"
              key={index}
            >
              {label}{' '}
              <SSText size="xs" color="muted">
                MvB
              </SSText>
            </SSText>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    height: 300
  },
  arrowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    height: 250,
    width: 55,
    alignSelf: 'flex-end'
  },
  arrow: {
    justifyContent: 'center',
    alignItems: 'center'
  }
})

export default SSFeeRateChart
