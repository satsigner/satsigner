import { useIsFocused } from '@react-navigation/native'
import { DashPathEffect, LinearGradient, vec } from '@shopify/react-native-skia'
import { useQuery } from '@tanstack/react-query'
import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { CartesianChart, StackedArea } from 'victory-native'

import { MempoolOracle } from '@/api/blockchain'
import type { MempoolStatistics } from '@/types/models/Blockchain'
import { time } from '@/utils/time'

export default function SSFeeRateChart() {
  return (
    <View style={styles.container}>
      <Chart />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRightWidth: 2,
    borderRightColor: '#fff',
    borderStyle: 'dashed',
    height: 300
  }
})

export function Chart() {
  const isFocused = useIsFocused()
  const [, setW] = React.useState(0)
  const [, setH] = React.useState(0)

  const { data: mempoolStatistics } = useQuery<MempoolStatistics[]>({
    queryKey: ['statistics'],
    queryFn: () => new MempoolOracle().getMempoolStatistics('24h'),
    enabled: isFocused,
    staleTime: time.minutes(5)
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
      domain={{ y: [1, 50] }}
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
  )
}
