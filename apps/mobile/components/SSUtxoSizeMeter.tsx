import { scaleLinear } from 'd3'
import { useMemo } from 'react'
import { type DimensionValue, StyleSheet, View } from 'react-native'

import { Colors } from '@/styles'

type SSUtxoSizeMeterProps = {
  size: number
  largestSize: number
  selected: boolean
}

function SSUtxoSizeMeter({
  size,
  largestSize,
  selected
}: SSUtxoSizeMeterProps) {
  // Collapse the range of values for display so small and medium
  // UTXO sizes don't look so tiny compared to larger values
  const root = 2
  const expSize = Math.pow(size, 1 / root)
  const largestExpSize = Math.pow(largestSize, 1 / root)

  const minDisplayPercentage = 1
  const maxDisplayPercentage = 82
  const scale = scaleLinear(
    [0, 100],
    [minDisplayPercentage, maxDisplayPercentage]
  ).clamp(true)

  const percentage = scale(Math.round((expSize / largestExpSize) * 100))
  const percentageText = (percentage + '%') as DimensionValue

  const selectedSizeBarStyle = useMemo(() => {
    return StyleSheet.compose(styles.sizeBarBase, {
      ...(selected ? styles.sizeBarSelected : {}),
      width: percentageText
    })
  }, [selected, percentageText])

  return (
    <View style={styles.containerBase}>
      <View style={styles.backgroundBarBase} />
      <View style={selectedSizeBarStyle} />
    </View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    position: 'absolute',
    width: '100%',
    height: 2
  },
  backgroundBarBase: {
    backgroundColor: Colors.gray[850],
    height: 2
  },
  sizeBarBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: Colors.white,
    opacity: 0.3,
    height: 2
  },
  sizeBarSelected: {
    top: -2,
    opacity: 1,
    borderRadius: 1,
    height: 6
  }
})

export default SSUtxoSizeMeter
