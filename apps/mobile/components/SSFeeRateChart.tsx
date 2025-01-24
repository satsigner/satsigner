import { useIsFocused } from '@react-navigation/native'
import {
  DashPathEffect,
  LinearGradient,
  useFont,
  vec
} from '@shopify/react-native-skia'
import { useQuery } from '@tanstack/react-query'
import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Polygon, Svg } from 'react-native-svg'
import { CartesianChart, StackedArea } from 'victory-native'

import { MempoolOracle } from '@/api/blockchain'
import { MempoolStatistics } from '@/types/models/Blockchain'

const sfProTextMedium = require('@/assets/fonts/SF-Pro-Text-Medium.otf')

export default function SSFeeRateChart() {
  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        <Chart />
      </View>
      <MemPoolLabel />
    </View>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    display: 'flex',
    flexDirection: 'row'
  },
  container: {
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'space-between',
    borderRightWidth: 2,
    borderRightColor: '#fff',
    borderStyle: 'dashed',
    height: 400,
    width: '100%'
  }
})

export function Chart() {
  const isFocused = useIsFocused()
  const font = useFont(sfProTextMedium, 12)
  const [, setW] = React.useState(0)
  const [, setH] = React.useState(0)

  const { data: mempoolStatistics } = useQuery<MempoolStatistics[]>({
    queryKey: ['statistics'],
    queryFn: () => new MempoolOracle().getMempoolStatistics('24h'),
    enabled: isFocused
  })

  const processData = useMemo(() => {
    if (!mempoolStatistics) return []

    return mempoolStatistics.map((entry) => {
      const timestamp = new Date(entry.added * 1000).toLocaleTimeString()
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
  }, [mempoolStatistics])

  if (!mempoolStatistics)
    return (
      <View>
        <Text style={{ color: '#fff' }}>Loading...</Text>
      </View>
    )

  return (
    <CartesianChart
      data={processData}
      xKey="x"
      yKeys={['high', 'medium', 'low', 'veryLow']}
      padding={0}
      domain={{ y: [0, 60] }}
      domainPadding={{ top: 0 }}
      xAxis={{
        font: null,
        labelOffset: 4,
        lineWidth: 0,
        labelColor: '#fff'
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
                colors: ['#D81B60'],
                start: highestY - 5,
                end: 20
              },
              {
                colors: ['#f7ce64', '#f7ce6420'],
                start: highestY - 25,
                end: lowestY
              },
              {
                colors: ['#22dacd', '#22dacd20'],
                start: highestY - 100,
                end: lowestY
              },
              {
                colors: ['#56aefb', '#56aefb20'],
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
  )
}

export function MemPoolLabel() {
  const labels = [
    '20 sat v/B',
    '15 sat v/B',
    '12 sat v/B',
    '11 sat v/B',
    '9 sat v/B',
    '8 sat v/B',
    '5 sat v/B',
    '3 sat v/B',
    '2 sat v/B',
    '1 sat v/B'
  ]

  return (
    <View style={arrowStyles.container}>
      <View style={arrowStyles.arrowContainer}>
        <Svg
          height="40"
          width="40"
          viewBox="0 0 100 100"
          style={arrowStyles.arrow}
        >
          <Polygon points="0,50 50,25 50,75" fill="white" />
        </Svg>
      </View>
      <View style={arrowStyles.labelsContainer}>
        {labels.map((label, index) => (
          <Text
            key={index}
            style={[
              arrowStyles.label,
              label === '8 sat v/B' ? arrowStyles.highlightLabel : null
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  )
}

const arrowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
    marginLeft: -8
  },
  arrow: {
    // transform: [{ rotate: '90deg' }]
  },
  labelsContainer: {},
  label: {
    color: '#6d6d68',
    fontSize: 12,
    marginBottom: 6
  },
  highlightLabel: {
    color: 'white',
    fontWeight: 'bold'
  }
})
