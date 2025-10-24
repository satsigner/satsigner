import {
  DashPathEffect,
  LinearGradient,
  useFont,
  vec
} from '@shopify/react-native-skia'
import { useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { CartesianChart, StackedArea } from 'victory-native'

import { type MempoolStatistics } from '@/types/models/Blockchain'
import { bytes } from '@/utils/bytes'

const sansSerif = require('@/assets/fonts/SF-Pro-Text-Medium.otf')

export type SSFeeRateChartProps = {
  mempoolStatistics: MempoolStatistics[] | undefined
  timeRange: 'week' | 'day' | '2hours'
}

function SSFeeRateChart({ mempoolStatistics, timeRange }: SSFeeRateChartProps) {
  const font = useFont(sansSerif, 12)
  const [, setW] = useState(0)
  const [, setH] = useState(0)

  const maxYDomainRef = useRef(100)

  const data = useMemo(() => {
    if (!mempoolStatistics) return []

    let maxYDomain = 100

    const result = mempoolStatistics
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

        const max = bytes.toKilo(Math.max(...entry.vsizes))
        if (max > maxYDomain) maxYDomain = max + 10 // +10 for the chart to have y-axis breathing space

        return {
          x: timestamp,
          '1-2': bytes.toKilo(entry.vsizes[1] || 0),
          '2-3': bytes.toKilo(entry.vsizes[2] || 0),
          '3-4': bytes.toKilo(entry.vsizes[3] || 0),
          '4-5': bytes.toKilo(entry.vsizes[4] || 0),
          '5-6': bytes.toKilo(entry.vsizes[5] || 0),
          '6-8': bytes.toKilo(entry.vsizes[6] || 0),
          '8-10': bytes.toKilo(entry.vsizes[7] || 0),
          '10-12': bytes.toKilo(entry.vsizes[8] || 0),
          '12-15': bytes.toKilo(entry.vsizes[9] || 0),
          '15-20': bytes.toKilo(entry.vsizes[10] || 0),
          '20-30': bytes.toKilo(entry.vsizes[11] || 0),
          '30-40': bytes.toKilo(entry.vsizes[12] || 0),
          '40-50': bytes.toKilo(entry.vsizes[13] || 0),
          '50-60': bytes.toKilo(entry.vsizes[14] || 0),
          '60-70': bytes.toKilo(entry.vsizes[15] || 0),
          '70-80': bytes.toKilo(entry.vsizes[16] || 0),
          '80-90': bytes.toKilo(entry.vsizes[17] || 0),
          '90-100': bytes.toKilo(entry.vsizes[18] || 0),
          '100-125': bytes.toKilo(entry.vsizes[19] || 0),
          '125-150': bytes.toKilo(entry.vsizes[20] || 0),
          '150-175': bytes.toKilo(entry.vsizes[21] || 0),
          '175-200': bytes.toKilo(entry.vsizes[22] || 0),
          '200-250': bytes.toKilo(entry.vsizes[23] || 0),
          '250-300': bytes.toKilo(entry.vsizes[24] || 0),
          '300-350': bytes.toKilo(entry.vsizes[25] || 0),
          '350-400': bytes.toKilo(entry.vsizes[26] || 0),
          '400-500': bytes.toKilo(entry.vsizes[27] || 0),
          '500-600': bytes.toKilo(entry.vsizes[28] || 0),
          '600-700': bytes.toKilo(entry.vsizes[29] || 0),
          '700-800': bytes.toKilo(entry.vsizes[30] || 0),
          '800-900': bytes.toKilo(entry.vsizes[31] || 0),
          '900-1000': bytes.toKilo(entry.vsizes[32] || 0),
          '1000-1200': bytes.toKilo(entry.vsizes[33] || 0),
          '1200-1400': bytes.toKilo(entry.vsizes[34] || 0),
          '1400+': bytes.toKilo(
            (entry.vsizes[35] || 0) +
              (entry.vsizes[36] || 0) +
              (entry.vsizes[37] || 0) +
              (entry.vsizes[38] || 0)
          )
        }
      })
      .reverse()

    maxYDomainRef.current = maxYDomain

    return result
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
        data={data}
        xKey="x"
        yKeys={[
          '1-2',
          '2-3',
          '3-4',
          '4-5',
          '5-6',
          '6-8',
          '8-10',
          '10-12',
          '12-15',
          '15-20',
          '20-30',
          '30-40',
          '40-50',
          '50-60',
          '60-70',
          '70-80',
          '80-90',
          '90-100',
          '100-125',
          '125-150',
          '150-175',
          '175-200',
          '200-250',
          '250-300',
          '300-350',
          '350-400',
          '400-500',
          '500-600',
          '600-700',
          '700-800',
          '800-900',
          '900-1000',
          '1000-1200',
          '1200-1400',
          '1400+'
        ]}
        padding={{ left: 8 }}
        domain={{ y: [0, maxYDomainRef.current] }}
        xAxis={{
          font,
          labelColor: '#787878',
          tickCount: 4,
          labelOffset: 4
        }}
        yAxis={[
          {
            font,
            labelColor: '#fff',
            linePathEffect: <DashPathEffect intervals={[4, 4]} />,
            labelOffset: 8,
            axisSide: 'right'
          }
        ]}
        onChartBoundsChange={({ left, right, top, bottom }) => {
          setW(right - left)
          setH(bottom - top)
        }}
      >
        {({ points, chartBounds }) => (
          <StackedArea
            points={[
              points['1-2'],
              points['2-3'],
              points['3-4'],
              points['4-5'],
              points['5-6'],
              points['6-8'],
              points['8-10'],
              points['10-12'],
              points['12-15'],
              points['15-20'],
              points['20-30'],
              points['30-40'],
              points['40-50'],
              points['50-60'],
              points['60-70'],
              points['70-80'],
              points['80-90'],
              points['90-100'],
              points['100-125'],
              points['125-150'],
              points['150-175'],
              points['175-200'],
              points['200-250'],
              points['250-300'],
              points['300-350'],
              points['350-400'],
              points['400-500'],
              points['500-600'],
              points['600-700'],
              points['700-800'],
              points['800-900'],
              points['900-1000'],
              points['1000-1200'],
              points['1200-1400'],
              points['1400+']
            ]}
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
