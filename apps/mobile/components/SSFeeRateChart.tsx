import { useFont } from '@shopify/react-native-skia'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { CartesianChart, StackedArea } from 'victory-native'

import { Colors } from '@/styles'
import { type MempoolStatistics } from '@/types/models/Blockchain'
import { bytes } from '@/utils/bytes'

const sansSerif = require('@/assets/fonts/SF-Pro-Text-Medium.otf')

const BORDER_PADDING = 12
const Y_VALUE_THRESHOLD_MVB = 3_000_000 // 3 MvB

const Y_KEYS = [
  '0-1',
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
] as const

type YKey = (typeof Y_KEYS)[number]

export type SSFeeRateChartProps = {
  mempoolStatistics: MempoolStatistics[] | undefined
  timeRange: 'week' | 'day' | '2hours'
}

const LABEL_FONT_SIZE = 9
const LABEL_LINE_HEIGHT = LABEL_FONT_SIZE + 4
const CHART_HEIGHT = 300
const MIN_KEY_SHARE = 0.02 // Only show key if its band is at least 2% of total at latest point

function SSFeeRateChart({ mempoolStatistics, timeRange }: SSFeeRateChartProps) {
  const font = useFont(sansSerif, 12)
  const labelFont = useFont(sansSerif, LABEL_FONT_SIZE)
  const [chartBounds, setChartBounds] = useState<{
    left: number
    right: number
    top: number
    bottom: number
  } | null>(null)
  const [labelTopsFromChart, setLabelTopsFromChart] = useState<
    { key: YKey; top: number }[]
  >([])
  const labelTopsRef = useRef<{ key: YKey; top: number }[]>([])

  const maxYDomainRef = useRef(0)
  const isMvB = useRef(false)

  const data = useMemo(() => {
    if (!mempoolStatistics) return []

    const totalVsizes = mempoolStatistics.map((entry) =>
      entry.vsizes.reduce((sum, v) => sum + (v || 0), 0)
    )
    const maxTotalVsize = Math.max(0, ...totalVsizes)
    const useMega = maxTotalVsize > Y_VALUE_THRESHOLD_MVB
    isMvB.current = useMega
    const convertFunction = useMega ? bytes.toMega : bytes.toKilo

    let maxYDomain = 0

    const result = mempoolStatistics
      .map((entry, i) => {
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

        const totalVsize = totalVsizes[i] ?? 0
        const convertedTotal = convertFunction(totalVsize)
        if (convertedTotal > maxYDomain) maxYDomain = convertedTotal

        return {
          x: timestamp,
          '0-1': convertFunction(entry.vsizes[0] || 0),
          '1-2': convertFunction(entry.vsizes[1] || 0),
          '2-3': convertFunction(entry.vsizes[2] || 0),
          '3-4': convertFunction(entry.vsizes[3] || 0),
          '4-5': convertFunction(entry.vsizes[4] || 0),
          '5-6': convertFunction(entry.vsizes[5] || 0),
          '6-8': convertFunction(entry.vsizes[6] || 0),
          '8-10': convertFunction(entry.vsizes[7] || 0),
          '10-12': convertFunction(entry.vsizes[8] || 0),
          '12-15': convertFunction(entry.vsizes[9] || 0),
          '15-20': convertFunction(entry.vsizes[10] || 0),
          '20-30': convertFunction(entry.vsizes[11] || 0),
          '30-40': convertFunction(entry.vsizes[12] || 0),
          '40-50': convertFunction(entry.vsizes[13] || 0),
          '50-60': convertFunction(entry.vsizes[14] || 0),
          '60-70': convertFunction(entry.vsizes[15] || 0),
          '70-80': convertFunction(entry.vsizes[16] || 0),
          '80-90': convertFunction(entry.vsizes[17] || 0),
          '90-100': convertFunction(entry.vsizes[18] || 0),
          '100-125': convertFunction(entry.vsizes[19] || 0),
          '125-150': convertFunction(entry.vsizes[20] || 0),
          '150-175': convertFunction(entry.vsizes[21] || 0),
          '175-200': convertFunction(entry.vsizes[22] || 0),
          '200-250': convertFunction(entry.vsizes[23] || 0),
          '250-300': convertFunction(entry.vsizes[24] || 0),
          '300-350': convertFunction(entry.vsizes[25] || 0),
          '350-400': convertFunction(entry.vsizes[26] || 0),
          '400-500': convertFunction(entry.vsizes[27] || 0),
          '500-600': convertFunction(entry.vsizes[28] || 0),
          '600-700': convertFunction(entry.vsizes[29] || 0),
          '700-800': convertFunction(entry.vsizes[30] || 0),
          '800-900': convertFunction(entry.vsizes[31] || 0),
          '900-1000': convertFunction(entry.vsizes[32] || 0),
          '1000-1200': convertFunction(entry.vsizes[33] || 0),
          '1200-1400': convertFunction(entry.vsizes[34] || 0),
          '1400+': convertFunction(
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

  const keysWithData = useMemo(() => {
    if (data.length === 0) return []
    const last = data[data.length - 1]
    const total = Y_KEYS.reduce((sum, key) => sum + (last[key] ?? 0), 0)
    if (total <= 0) return []
    return Y_KEYS.filter((key) => {
      const value = last[key] ?? 0
      return value > 0 && value / total >= MIN_KEY_SHARE
    })
  }, [data])

  useEffect(() => {
    setLabelTopsFromChart(labelTopsRef.current)
  }, [chartBounds, data, keysWithData])

  if (!mempoolStatistics)
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', padding: 16 }}>Loading chart...</Text>
      </View>
    )

  return (
    <View style={styles.container}>
      <View style={styles.chartBorderWrapper}>
        <View style={styles.chartInnerRow}>
          <View style={styles.chartWrapper}>
            <CartesianChart
              data={data}
              xKey="x"
              yKeys={[...Y_KEYS]}
              padding={{ right: 4 }}
              domain={{ y: [0, maxYDomainRef.current] }}
              domainPadding={{ top: 100 }}
              onChartBoundsChange={(bounds) => setChartBounds(bounds)}
              axisOptions={{
                font: labelFont ?? font,
                formatYLabel: (v) => `${v} ${isMvB.current ? 'MvB' : 'kvB'}`,
                axisSide: { x: 'bottom', y: 'left' },
                labelColor: { x: '#787878', y: '#ffffff' },
                tickCount: { x: 4, y: 8 },
                labelOffset: { x: 4, y: 8 }
              }}
            >
              {({ points, chartBounds: bounds }) => {
                if (keysWithData.length > 0 && bounds) {
                  const withTops = keysWithData
                    .map((key) => {
                      const pts = points[key]
                      if (
                        !pts ||
                        typeof pts.length !== 'number' ||
                        pts.length === 0
                      )
                        return null
                      const last = pts[pts.length - 1] as {
                        x: number
                        y: number
                      }
                      const y = last?.y ?? 0
                      return { key, top: y - LABEL_FONT_SIZE }
                    })
                    .filter((x): x is { key: YKey; top: number } => x !== null)
                  const spaced = [...withTops]
                  for (let i = spaced.length - 2; i >= 0; i--) {
                    const below = spaced[i + 1].top + LABEL_LINE_HEIGHT
                    if (spaced[i].top < below) {
                      spaced[i].top = Math.min(
                        below,
                        bounds.bottom - LABEL_FONT_SIZE
                      )
                    }
                  }
                  labelTopsRef.current = spaced.map(({ key, top }) => ({
                    key,
                    top: Math.max(
                      0,
                      Math.min(top, CHART_HEIGHT - LABEL_FONT_SIZE)
                    )
                  }))
                } else {
                  labelTopsRef.current = []
                }
                return (
                  <StackedArea
                    points={Y_KEYS.map((key: YKey) => points[key])}
                    y0={bounds.bottom}
                    curveType="natural"
                    animate={{ type: 'spring' }}
                    colors={[
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF',
                      '#939393',
                      '#FFFFFF'
                    ]}
                  />
                )
              }}
            </CartesianChart>
          </View>
          {labelTopsFromChart.length > 0 && (
            <View style={styles.keyLabels}>
              {labelTopsFromChart.map(({ key, top }) => (
                <Text
                  key={key}
                  numberOfLines={1}
                  style={[styles.keyLabelText, { position: 'absolute', top }]}
                >
                  {key} sat/vB
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chartBorderWrapper: {
    borderColor: Colors.gray[700],
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    padding: BORDER_PADDING
  },
  chartInnerRow: {
    flex: 1,
    flexDirection: 'row',
    height: CHART_HEIGHT
  },
  chartWrapper: {
    flex: 1,
    minWidth: 0
  },
  container: {
    flex: 1,
    height: CHART_HEIGHT + BORDER_PADDING * 2
  },
  keyLabels: {
    height: CHART_HEIGHT,
    minWidth: 56,
    flexShrink: 0,
    paddingLeft: 8,
    paddingVertical: 2,
    position: 'relative'
  },
  keyLabelText: {
    color: '#B0B0B0',
    fontSize: LABEL_FONT_SIZE
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
